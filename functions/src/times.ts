import * as moment from "moment-timezone";

export function processTimeZone(tz: string) {
    switch (tz) {
      case "PT":
        return "America/Los_Angeles";
      case "MT":
        return "America/Denver";
      case "CT":
        return "America/Chicago"
      case "ET":
        return "America/New_York"
      default:
        return undefined;
    }
}

export function parseTime(dayTime: string, timezone: string, getTimestamp: () => moment.Moment) {
  const week = getTimestamp().tz(timezone).startOf("week");
  const [day, time] = dayTime.split(" ");
  switch (day) {
    case "Sun":
    case "Sunday":
      break;
    case "Mon":
    case "Monday":
      week.add(1, "days");
      break;
    case "Tue":
    case "Tuesday":
      week.add(2, "days");
      break;
    case "Wed":
    case "Wednesday":
      week.add(3, "days");
      break;
    case "Thu":
    case "Thursday":
      week.add(4, "days");
      break;
    case "Fri":
    case "Friday":
      week.add(5, "days");
      break;
    case "Sat":
    case "Saturday":
      week.add(6, "days");
      break;
    default:
      console.error(new Error("could not parse time: " + dayTime));
      return undefined;
  }

  switch (time) {
    case "6pm":
      return week.add(18, "hours");
    case "7pm":
      return week.add(19, "hours")
    case "8pm":
      return week.add(20, "hours")
    case "9pm":
      return week.add(21, "hours")
    default:
      console.error(new Error("could not parse time: " + dayTime));
      return undefined;
  }
}

export enum Timezone {
  PT = "PT",
  MT = "MT",
  CT = "CT",
  ET = "ET",
}

function dayOptions(tz: Timezone,  getTimestamp: () => moment.Moment) {
  const parsed = processTimeZone(tz);
  if (!parsed) {
    return [];
  }
  return [
    getTimestamp().tz(parsed).add(1, "days").startOf("day"),
    getTimestamp().tz(parsed).add(2, "days").startOf("day"),
    getTimestamp().tz(parsed).add(3, "days").startOf("day"),
  ]
}

function timeOptions(tz: Timezone, matchTz: Timezone) {
  switch (true) {
    // PT
    case (tz === Timezone.PT && matchTz === Timezone.PT):
      return [18, 19, 20];
    case (tz === Timezone.PT && matchTz === Timezone.MT):
      return [18, 19, 20];
    case (tz === Timezone.PT && matchTz === Timezone.CT):
      return [18];
    case (tz === Timezone.PT && matchTz === Timezone.ET):
      return [18];
    // MT
    case (tz === Timezone.MT && matchTz === Timezone.PT):
      return [19, 20, 21];
    case (tz === Timezone.MT && matchTz === Timezone.MT):
      return [19, 20, 21];
    case (tz === Timezone.MT && matchTz === Timezone.CT):
      return [19];
    case (tz === Timezone.MT && matchTz === Timezone.ET):
      return [19];
    // CT
    case (tz === Timezone.CT && matchTz === Timezone.PT):
      return [20];
    case (tz === Timezone.CT && matchTz === Timezone.MT):
      return [20];
    case (tz === Timezone.CT && matchTz === Timezone.CT):
      return [18, 19, 20];
    case (tz === Timezone.CT && matchTz === Timezone.ET):
      return [18, 19, 20];
    // ET
    case (tz === Timezone.ET && matchTz === Timezone.PT):
      return [21];
    case (tz === Timezone.ET && matchTz === Timezone.MT):
      return [21];
    case (tz === Timezone.ET && matchTz === Timezone.CT):
      return [19, 20, 21];
    case (tz === Timezone.ET && matchTz === Timezone.ET):
      return [19, 20, 21];
    default:
      return [];
  }
}

export function videoTimeOptions(tz: Timezone, matchTz: Timezone,  getTimestamp: () => moment.Moment) {
  const days = dayOptions(tz, getTimestamp);
  const ret: string[] = [];
  days.forEach(d => {
    const times = timeOptions(tz, matchTz);
    times.forEach(t => ret.push(d.clone().add(t, "hours").format()));
  });
  return ret;
}
