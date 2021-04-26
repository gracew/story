import { Modal, ModalProps } from "antd";
import React, { FunctionComponent } from "react";
import "./StoryModal.css";

const StoryModal: FunctionComponent<ModalProps> = (props) => {
  const { className, ...otherProps } = props;
  return <Modal
    closable={false}
    {...otherProps}
    className={`story-modal ${className}`}
  >
    {props.children}
  </Modal>
}

export default StoryModal;
