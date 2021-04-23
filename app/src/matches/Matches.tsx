import React, {useEffect, useState} from "react";
import {useHistory} from "react-router-dom";
import {getUpcomingMatches, UpcomingMatch} from "../apiClient";
import CenteredSpin from "../components/CenteredSpin";
import {Pagination} from "antd";

// TODO: WIP
export default function Matches(): JSX.Element {
  const history = useHistory();
  const [upcomingMatches, setUpcomingMatches] = useState<UpcomingMatch[]>();
  // const [pageIndex, setPageIndex] = useState<number>(0);

  useEffect(() => {
    (async () => {
     setUpcomingMatches(await getUpcomingMatches());
    })();
  }, []);

  if (!upcomingMatches) {
    return <CenteredSpin />;
  }
  if (upcomingMatches.length === 0) {
    history.push("/profile")
  }

  return (
    <Pagination total={upcomingMatches.length} pageSize={1} onChange={(pageNo) => {
    }
  } />);
}