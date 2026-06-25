import React from "react";
import {
  Bell,
  CalendarDays,
  ExternalLink,
  Newspaper,
  RefreshCw,
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
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

function asList(value) {
  return Array.isArray(value) ? value : [];
}

function changeCount(day) {
  return asList(day?.added).length + asList(day?.updated).length;
}

function formatTimestamp(value) {
  if (!value) return "Not checked yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(value) {
  if (!value) return "Unknown day";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function NewsLink({ item, prefix }) {
  return (
    <a
      className="group flex min-w-0 items-start justify-between gap-3 rounded-lg border bg-background p-3 text-left transition hover:border-primary/30 hover:bg-muted/40"
      href={item.url}
      rel="noopener noreferrer"
      target="_blank"
    >
      <span className="min-w-0">
        <span className="block text-xs font-medium text-muted-foreground">
          {prefix ? `${prefix} - ` : ""}{item.date || "No date"}{item.category ? ` / ${item.category}` : ""}
        </span>
        <span className="mt-1 block line-clamp-2 text-sm font-medium leading-snug">{item.title}</span>
        {item.summary ? (
          <span className="mt-1 block line-clamp-2 text-xs leading-5 text-muted-foreground">{item.summary}</span>
        ) : null}
      </span>
      <ExternalLink className="mt-0.5 size-4 shrink-0 text-muted-foreground transition group-hover:text-primary" />
    </a>
  );
}

function ChangeGroup({ label, items }) {
  if (!items.length) return null;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">{label}</div>
      <div className="flex min-w-0 flex-col gap-2">
        {items.map((item) => (
          <NewsLink item={item} key={item.key || item.url || item.title} prefix={label} />
        ))}
      </div>
    </div>
  );
}

function DailySummaryCard({ day }) {
  const added = asList(day.added);
  const updated = asList(day.updated);
  const totalChanges = changeCount(day);

  return (
    <Card size="sm" className={totalChanges ? "border-primary/20" : "bg-muted/20"}>
      <CardHeader>
        <CardTitle className="flex min-w-0 items-center gap-2">
          <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{formatDate(day.date)}</span>
        </CardTitle>
        <CardDescription>{formatTimestamp(day.checkedAt)}</CardDescription>
        <CardAction>
          <Badge variant={totalChanges ? "default" : "outline"}>
            {totalChanges ? `${totalChanges} change${totalChanges === 1 ? "" : "s"}` : "No changes"}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        {totalChanges ? (
          <div className="grid gap-3 lg:grid-cols-2">
            <ChangeGroup label="New" items={added} />
            <ChangeGroup label="Updated" items={updated} />
          </div>
        ) : (
          <div className="rounded-lg border bg-background/75 p-3 text-sm text-muted-foreground">No changes</div>
        )}
      </CardContent>
    </Card>
  );
}

export function AnthropicNewsPage({ news }) {
  const history = asList(news?.history);
  const items = asList(news?.items);
  const latest = history[0] || null;
  const latestChanges = latest ? changeCount(latest) : 0;

  if (!news) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 py-8">
        <Empty className="min-h-64 border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Newspaper />
            </EmptyMedia>
            <EmptyTitle>No Anthropic News snapshot</EmptyTitle>
            <EmptyDescription>The tracker has not recorded a daily check yet.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 py-4 sm:py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Newspaper className="size-5 text-primary" />
            Anthropic News
          </CardTitle>
          <CardDescription>Daily summary from anthropic.com/news</CardDescription>
          <CardAction>
            <Button asChild variant="outline" size="sm">
              <a href="https://www.anthropic.com/news" rel="noopener noreferrer" target="_blank">
                Open
                <ExternalLink data-icon="inline-end" />
              </a>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border bg-background p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Bell className="size-3.5" />
                Today
              </div>
              <div className="mt-2 text-lg font-medium">{latest?.summary || "No checks"}</div>
            </div>
            <div className="rounded-lg border bg-background p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <RefreshCw className="size-3.5" />
                Last checked
              </div>
              <div className="mt-2 text-lg font-medium">{formatTimestamp(news.checkedAt)}</div>
            </div>
            <div className="rounded-lg border bg-background p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Newspaper className="size-3.5" />
                Tracked
              </div>
              <div className="mt-2 text-lg font-medium">{items.length} item{items.length === 1 ? "" : "s"}</div>
            </div>
          </div>
          {latest ? (
            <div className="mt-3">
              <Badge variant={latestChanges ? "default" : "outline"}>
                {latestChanges ? "New notification" : "No changes"}
              </Badge>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="flex min-w-0 flex-col gap-3">
          <div>
            <h2 className="text-base font-semibold">Daily Summary</h2>
            <p className="mt-1 text-sm text-muted-foreground">What changed by day</p>
          </div>
          {history.length ? (
            history.map((day) => <DailySummaryCard day={day} key={day.date || day.checkedAt} />)
          ) : (
            <Empty className="min-h-48 border bg-card">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CalendarDays />
                </EmptyMedia>
                <EmptyTitle>No daily summaries</EmptyTitle>
                <EmptyDescription>No Anthropic News checks are present in the monitor history.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </section>

        <aside className="flex min-w-0 flex-col gap-3">
          <div>
            <h2 className="text-base font-semibold">Current News</h2>
            <p className="mt-1 text-sm text-muted-foreground">Latest tracked entries</p>
          </div>
          <Card>
            <CardContent className="flex flex-col gap-2 pt-0">
              {items.length ? (
                items.slice(0, 12).map((item) => (
                  <NewsLink item={item} key={item.key || item.url || item.title} />
                ))
              ) : (
                <div className="py-10 text-center text-sm text-muted-foreground">No tracked news items</div>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
