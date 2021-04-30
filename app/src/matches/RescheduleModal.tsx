import { Button, ModalProps, Radio } from "antd";
import moment from "moment";
import React, { FunctionComponent, useState } from "react";
import StoryModal from "../components/StoryModal";
import "./RescheduleModal.css";

interface RescheduleModalProps {
  timeOptions: Date[];
  matchName: string;

  rescheduleLoading: boolean;
  onReschedule: (date: Date) => void;
  onCancelMatch: () => void;
  onCancel: () => void;
}

const RescheduleModal: FunctionComponent<ModalProps & RescheduleModalProps> = (props) => {
  const [selectedDay, setSelectedDay] = useState<string>();
  const [selectedOption, setSelectedOption] = useState<Date>();

  const timesByDay: Record<string, Date[]> = {};
  props.timeOptions.forEach(option => {
    const m = moment(option);
    const day = m.format("ddd");
    if (!(day in timesByDay)) {
      timesByDay[day] = [];
    }
    timesByDay[day].push(option)
  })

  return <StoryModal {...props}
    okText="Reschedule"
    footer={[
      <Button key="cancel-match" onClick={props.onCancelMatch}>
        No times work
      </Button>,
      <Button
        key="reschedule"
        type="primary"
        disabled={selectedOption === undefined}
        onClick={() => props.onReschedule(selectedOption!)}
        loading={props.rescheduleLoading}
      >
        Reschedule
      </Button>,
    ]}
    onCancel={props.onCancel}
  >
    <div>Pick a new time for your 20 minute call with {props.matchName}.</div>
    <div className="reschedule-header">Date</div>
    <Radio.Group className="reschedule-options" value={selectedDay}>
      {Object.keys(timesByDay).map(day =>
        <Radio.Button key={day} value={day} onClick={() => setSelectedDay(day)}>{day}</Radio.Button>
      )}
    </Radio.Group>

    <div className="reschedule-header">Time</div>
    {!selectedDay &&
      <Radio.Group className="reschedule-options">
        <Radio.Button disabled>Select a day to view times</Radio.Button>
      </Radio.Group>
    }

    {selectedDay && <Radio.Group className="reschedule-options">
      {(timesByDay[selectedDay] || []).map(option => {
        const formattedOption = moment(option).format("ha");
        return <Radio.Button key={formattedOption} value={option} onClick={() => setSelectedOption(option)}>
          {formattedOption}
        </Radio.Button>
      })}
    </Radio.Group>}
  </StoryModal>
}

export default RescheduleModal;
