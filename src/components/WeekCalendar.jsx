// WeekCalendar.jsx — a Mon–Sun week grid of meetings. `date` (YYYY-MM-DD) anchors
// the week and the highlighted "today" column; `weekMeetings` are the backend's
// agenda.weekMeetings ({ id, date, start, title, status, linkedNotes }). Clicking
// an event with a linked note opens it (when onOpenNote is provided).

import React from "react";
import { Icon } from "./shared.jsx";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const EVT_CLS = { accepted: "rs-yes", tentative: "rs-maybe", declined: "rs-no" };

function buildWeek(iso) {
  const d = new Date(iso + "T00:00:00");
  const mon = new Date(d);
  mon.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // back to Monday
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(mon);
    x.setDate(mon.getDate() + i);
    const isoX = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
    return { iso: isoX, label: DOW[i], dayNum: x.getDate(), isToday: isoX === iso };
  });
}

export function WeekCalendar({ weekMeetings = [], date, onOpenNote }) {
  const anchor = date || new Date().toISOString().slice(0, 10);
  const weekDays = buildWeek(anchor);
  const byDay = {};
  weekMeetings.forEach((m) => { if (m.date) (byDay[m.date] = byDay[m.date] || []).push(m); });

  return (
    <div className="cal-week">
      {weekDays.map((d) => (
        <div className={"cal-col" + (d.isToday ? " is-today" : "")} key={d.iso}>
          <div className="cal-colhead">
            <span className="cal-dow">{d.label}</span>
            <span className="cal-daynum">{d.dayNum}</span>
          </div>
          <div className="cal-colbody">
            {(byDay[d.iso] || []).map((m) => {
              const cls = EVT_CLS[m.status] || "rs-yes";
              const body = (
                <>
                  {m.start ? <span className="cal-evt-time">{m.start}</span> : null}
                  <span className="cal-evt-title">{m.title}</span>
                </>
              );
              return (m.linkedNotes || []).length && onOpenNote
                ? <button className={"cal-evt " + cls} key={m.id} title={m.title} onClick={() => onOpenNote(m.linkedNotes[0])} type="button">{body}</button>
                : <div className={"cal-evt " + cls} key={m.id} title={m.title}>{body}</div>;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
