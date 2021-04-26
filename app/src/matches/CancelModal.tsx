import { ModalProps } from "antd";
import React from "react";
import StoryModal from "../components/StoryModal";

const CancelModal = (props: ModalProps) => {
    return <StoryModal {...props} okText="Keep this time" cancelText="Cancel">
        <div>Looks like you both aren't free later this week. Do you want to cancel your call?</div>
    </StoryModal>
}

export default CancelModal;
