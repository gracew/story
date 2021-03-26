export function processTimeZone(tz: string) {
    if (tz === "PT") {
        return "America/Los_Angeles"
    } else if (tz === "CT") {
        return "America/Chicago"
    } else if (tz === "ET") {
        return "America/New_York"
    }
    return undefined;
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