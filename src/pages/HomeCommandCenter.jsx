import React from "react";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Hash,
  Inbox,
  Link2,
  MessageSquare,
  Radio,
  Sparkles,
  Users,
  Video,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Avatar, fmtDate, sourceMeta } from "../components/shared.jsx";
import { cn } from "@/lib/utils";

const TAGS_TO_IGNORE = new Set(["daily", "slack", "obsidian", "synthesis"]);
const ENERGY_TONES = ["teal", "violet", "amber", "rose"];

function compareDateDesc(a, b) {
  return String(b.date || "").localeCompare(String(a.date || ""));
}

function openTaskCount(items = []) {
  return items.filter((item) => !item.done).length;
}

function sourceLabel(note) {
  if (note.source === "slack" && note.channel) return note.channel;
  return sourceMeta(note.source).label;
}

function buildWorkstreams(notes) {
  const byTag = new Map();
  notes.forEach((note) => {
    (note.tags || [])
      .filter((tag) => tag && !TAGS_TO_IGNORE.has(tag))
      .forEach((tag) => {
        const current = byTag.get(tag) || { tag, count: 0, latest: note };
        current.count += 1;
        if (compareDateDesc(note, current.latest) < 0) current.latest = note;
        byTag.set(tag, current);
      });
  });
  return Array.from(byTag.values())
    .sort((a, b) => b.count - a.count || compareDateDesc(a.latest, b.latest))
    .slice(0, 5);
}

function toneForIndex(index) {
  return ENERGY_TONES[index % ENERGY_TONES.length];
}

function progressPercent(done, total) {
  if (!total) return 0;
  return Math.round((done / total) * 100);
}

function SourceAnchor({ note }) {
  if (!note?.permalink) return null;
  return (
    <Button asChild variant="ghost" size="sm" className="-mr-2 text-muted-foreground">
      <a href={note.permalink} target="_blank" rel="noopener noreferrer" aria-label={`Open ${sourceLabel(note)}`}>
        <ExternalLink data-icon="inline-start" />
        Source
      </a>
    </Button>
  );
}

function MiniNote({ note, onOpen, dense = false }) {
  const meta = sourceMeta(note.source);
  return (
    <div className="energy-note-card rounded-lg border bg-background/80 p-3">
      <div className="flex min-w-0 items-center gap-2">
        <Avatar name={note.person} size={20} />
        <span className="truncate text-xs font-medium text-muted-foreground">{note.person || "Unknown"}</span>
        <span className="text-muted-foreground/50">·</span>
        <span className="inline-flex min-w-0 items-center gap-1 text-xs font-medium" style={{ color: meta.color }}>
          {note.source === "slack" ? <Hash className="size-3" /> : <Link2 className="size-3" />}
          <span className="truncate">{sourceLabel(note)}</span>
        </span>
        {note.importance ? (
          <Badge variant={note.importance === "project" ? "default" : "secondary"} className="ml-auto">
            {note.importance === "project" ? "Project" : "Owner"}
          </Badge>
        ) : null}
      </div>
      <button
        className="mt-2 block w-full text-left"
        onClick={() => onOpen(note)}
        type="button"
      >
        <div className="line-clamp-2 text-sm font-medium leading-snug">{note.title}</div>
        {!dense && note.preview ? (
          <div className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{note.preview}</div>
        ) : null}
      </button>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{fmtDate(note.date)}</span>
        <SourceAnchor note={note} />
      </div>
    </div>
  );
}

function DailyTaskRow({ task, index, daily, onToggleDailyTask }) {
  const checked = Boolean(task.done);
  return (
    <label className="energy-task-row flex min-w-0 cursor-pointer items-start gap-3 rounded-lg border bg-background/75 p-3">
      <Checkbox
        checked={checked}
        onCheckedChange={(next) => onToggleDailyTask(daily.id, index, Boolean(next))}
        aria-label={task.text}
      />
      <span className={cn("text-sm leading-5", checked && "text-muted-foreground line-through")}>{task.text}</span>
    </label>
  );
}

function EmptyState({ icon: IconComponent, title, description }) {
  return (
    <Empty className="min-h-36 border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <IconComponent />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function LoadingPreview() {
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {[0, 1, 2].map((index) => (
        <Card key={index}>
          <CardHeader>
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-40" />
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-8 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function MetricTile({ label, value, tone, progress }) {
  return (
    <div className="energy-metric rounded-lg border bg-background p-3" data-tone={tone}>
      <div className="text-2xl font-medium">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="energy-meter" aria-hidden="true">
        <span style={{ width: `${Math.max(8, Math.min(100, progress))}%` }} />
      </div>
    </div>
  );
}

export function HomeCommandCenter({
  daily,
  dateLong,
  essence,
  greeting,
  loading,
  meetings = [],
  notes = [],
  onAsk,
  onGoMeetings,
  onGoWiki,
  onOpenNote,
  onToggleDailyTask,
  suggestions = [],
  today,
}) {
  const activeNotes = React.useMemo(
    () => notes.filter((note) => !note.archived).sort(compareDateDesc),
    [notes]
  );
  const focusNotes = React.useMemo(() => {
    const projectNotes = activeNotes.filter((note) => note.importance === "project");
    return (projectNotes.length ? projectNotes : activeNotes).slice(0, 4);
  }, [activeNotes]);
  const slackNotes = React.useMemo(
    () => activeNotes.filter((note) => note.source === "slack").slice(0, 4),
    [activeNotes]
  );
  const workstreams = React.useMemo(() => buildWorkstreams(activeNotes), [activeNotes]);
  const latestMeetings = React.useMemo(
    () => meetings.slice().sort(compareDateDesc).slice(0, 3),
    [meetings]
  );
  const dailyTasks = daily?.tasks || [];
  const dailyOpenCount = openTaskCount(dailyTasks);
  const dailyDoneCount = dailyTasks.length - dailyOpenCount;
  const dailyProgress = progressPercent(dailyDoneCount, dailyTasks.length);
  const meetingOpenCount = meetings.reduce((sum, meeting) => sum + openTaskCount(meeting.todos || []), 0);
  const slackLinkCount = slackNotes.filter((note) => note.permalink).length;

  if (loading) return <LoadingPreview />;

  return (
    <div className="energy-home mx-auto flex w-full max-w-6xl flex-col gap-4 py-4 sm:py-8">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.9fr)]">
        <div className="energy-hero flex min-w-0 flex-col justify-between gap-5 rounded-xl border bg-card p-5 text-card-foreground ring-1 ring-foreground/5 sm:p-6">
          <div className="energy-scan" aria-hidden="true" />
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="energy-badge">
              <CalendarDays />
              {dateLong}
            </Badge>
            {daily ? (
              <Badge variant="outline" className="energy-badge">{daily.date === today ? "Today" : "Latest daily"}</Badge>
            ) : null}
            <Badge variant="outline" className="energy-live-badge">
              <Radio />
              Live vault
            </Badge>
          </div>
          <div>
            <h1 className="max-w-3xl text-3xl font-medium leading-tight tracking-normal text-foreground sm:text-4xl">
              {greeting}.
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">{essence}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <Button key={suggestion} variant="outline" className="energy-ask" onClick={() => onAsk(suggestion)} type="button">
                <Sparkles data-icon="inline-start" />
                {suggestion}
              </Button>
            ))}
          </div>
        </div>

        <Card className="energy-card">
          <CardHeader>
            <CardTitle>Action Queue</CardTitle>
            <CardDescription>{dailyOpenCount + meetingOpenCount} open items across daily and meetings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              <MetricTile label="Daily" progress={dailyProgress} tone="teal" value={dailyOpenCount} />
              <MetricTile label="Meeting" progress={Math.min(100, meetingOpenCount)} tone="violet" value={meetingOpenCount} />
              <MetricTile label="Slack links" progress={Math.min(100, slackLinkCount * 20)} tone="amber" value={slackLinkCount} />
            </div>
            <Separator className="my-4" />
            {daily ? (
              <Button variant="secondary" className="w-full justify-between" onClick={() => onOpenNote(daily)} type="button">
                <span className="inline-flex min-w-0 items-center gap-2 truncate">
                  <CheckCircle2 data-icon="inline-start" />
                  <span className="truncate">{daily.title}</span>
                </span>
                <ArrowRight data-icon="inline-end" />
              </Button>
            ) : (
              <EmptyState icon={Inbox} title="No daily note" description="No daily note is present in the loaded vault state." />
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Tabs defaultValue="focus" className="min-w-0">
          <TabsList>
            <TabsTrigger value="focus">Focus</TabsTrigger>
            <TabsTrigger value="recent">Recent</TabsTrigger>
            <TabsTrigger value="slack">Slack</TabsTrigger>
          </TabsList>
          <TabsContent value="focus" className="mt-2">
            <Card>
              <CardHeader>
                <CardTitle>Focus This Week</CardTitle>
                <CardDescription>Project-marked notes, newest first</CardDescription>
              </CardHeader>
              <CardContent>
                {focusNotes.length ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {focusNotes.map((note) => (
                      <MiniNote key={note.id} note={note} onOpen={onOpenNote} />
                    ))}
                  </div>
                ) : (
                  <EmptyState icon={Inbox} title="No surfaced notes" description="No active notes are present in the loaded vault state." />
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="recent" className="mt-2">
            <Card>
              <CardHeader>
                <CardTitle>New Since Refresh</CardTitle>
                <CardDescription>Latest active notes from the vault</CardDescription>
              </CardHeader>
              <CardContent>
                {activeNotes.length ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {activeNotes.slice(0, 4).map((note) => (
                      <MiniNote key={note.id} note={note} onOpen={onOpenNote} />
                    ))}
                  </div>
                ) : (
                  <EmptyState icon={Inbox} title="No recent notes" description="No active notes are present in the loaded vault state." />
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="slack" className="mt-2">
            <Card>
              <CardHeader>
                <CardTitle>Slack With Sources</CardTitle>
                <CardDescription>Slack notes keep their source link when the vault provides one</CardDescription>
              </CardHeader>
              <CardContent>
                {slackNotes.length ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {slackNotes.map((note) => (
                      <MiniNote key={note.id} note={note} onOpen={onOpenNote} />
                    ))}
                  </div>
                ) : (
                  <EmptyState icon={MessageSquare} title="No Slack notes" description="No Slack notes are present in the loaded vault state." />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex min-w-0 flex-col gap-4">
          <Card className="energy-card">
            <CardHeader>
              <CardTitle>Daily Note</CardTitle>
              <CardDescription>{daily ? daily.title : "No daily note loaded"}</CardDescription>
            </CardHeader>
            <CardContent>
              {dailyTasks.length ? (
                <ScrollArea className="h-64 pr-3">
                  <div className="flex flex-col gap-2">
                    {dailyTasks.map((task, index) => (
                      <DailyTaskRow
                        daily={daily}
                        index={index}
                        key={`${task.text}-${index}`}
                        onToggleDailyTask={onToggleDailyTask}
                        task={task}
                      />
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <EmptyState icon={CheckCircle2} title="No daily tasks" description="No tasks are present in the loaded daily note." />
              )}
            </CardContent>
          </Card>

          <Card className="energy-card">
            <CardHeader>
              <CardTitle>Meetings</CardTitle>
              <CardDescription>{meetingOpenCount} open items from Zoom notes</CardDescription>
              <CardAction>
                <Button variant="ghost" size="sm" onClick={onGoMeetings} type="button">
                  Open
                  <ArrowRight data-icon="inline-end" />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              {latestMeetings.length ? (
                <div className="flex flex-col gap-2">
                  {latestMeetings.map((meeting) => (
                    <div key={meeting.id} className="energy-meeting-row rounded-lg border bg-background p-3">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Video className="size-3" />
                        <span>{fmtDate(meeting.date)}</span>
                        {(meeting.todos || []).length ? <span>· {openTaskCount(meeting.todos)} open</span> : null}
                      </div>
                      <div className="mt-1 line-clamp-2 text-sm font-medium">{meeting.title}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={Video} title="No meetings" description="No Zoom meetings are present in the loaded vault state." />
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.7fr)]">
        <Card className="energy-card">
          <CardHeader>
            <CardTitle>Workstreams</CardTitle>
            <CardDescription>Top tags across active notes</CardDescription>
          </CardHeader>
          <CardContent>
            {workstreams.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {workstreams.map((stream, index) => (
                  <div key={stream.tag} className="energy-stream rounded-lg border bg-background p-3" data-tone={toneForIndex(index)}>
                    <div className="flex items-center justify-between gap-3">
                      <Badge variant="outline">#{stream.tag}</Badge>
                      <span className="text-xs text-muted-foreground">{stream.count} notes</span>
                    </div>
                    <button className="mt-3 block w-full text-left" onClick={() => onOpenNote(stream.latest)} type="button">
                      <div className="line-clamp-2 text-sm font-medium">{stream.latest.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{fmtDate(stream.latest.date)}</div>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={Hash} title="No workstreams" description="No tags are present in the loaded active notes." />
            )}
          </CardContent>
        </Card>

        <Card className="energy-card">
          <CardHeader>
            <CardTitle>Closest Collaborators</CardTitle>
            <CardDescription>People surfaced from active notes</CardDescription>
            <CardAction>
              <Button variant="ghost" size="sm" onClick={onGoWiki} type="button">
                Wiki
                <ArrowRight data-icon="inline-end" />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              {activeNotes.length ? (
                Object.entries(
                  activeNotes.reduce((counts, note) => {
                    const name = note.person || "Unknown";
                    counts[name] = (counts[name] || 0) + 1;
                    return counts;
                  }, {})
                )
                  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
                  .slice(0, 5)
                  .map(([name, count]) => (
                    <div key={name} className="energy-person flex items-center gap-3 rounded-lg border bg-background p-3">
                      <Avatar name={name} size={28} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{name}</div>
                        <div className="text-xs text-muted-foreground">{count} notes</div>
                      </div>
                      <Users className="size-4 text-muted-foreground" />
                    </div>
                  ))
              ) : (
                <EmptyState icon={Users} title="No people" description="No active notes are present in the loaded vault state." />
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Clock3 className="size-3" />
        <span>Vault date: {today}</span>
      </div>
    </div>
  );
}
