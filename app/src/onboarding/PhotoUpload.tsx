import { CloseOutlined, LoadingOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Upload } from "antd";
import firebase from 'firebase';
import React, { useEffect, useState } from "react";
import * as uuid from "uuid";
import "./PhotoUpload.css";

interface PhotoUploadProps {
  value?: string; // path, e.g. photos/XXX
  update: (path?: string) => void;
}

function PhotoUpload(props: PhotoUploadProps) {
  const [imageUrl, setImageUrl] = useState();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!props.value) {
      setImageUrl(undefined);
    } else {
      firebase.storage().ref(props.value).getDownloadURL().then(url => setImageUrl(url));
    }
  }, [props.value])

  async function upload(opts: any) {
    setLoading(true);
    const path = `photos/${uuid.v4()}`;
    await firebase.storage().ref(path).put(opts.file);
    props.update(path);
    setLoading(false);
  }

  function onRemoveImage() {
    props.update(undefined);
  }

  const uploadButton = (
    <div>
      {loading ? <LoadingOutlined /> : <PlusOutlined />}
      <div style={{ marginTop: 8 }}>Upload</div>
    </div>
  );
  return (
    <div className="photo-upload-container">
      <Upload
        className="photo-upload"
        name="avatar"
        accept="image/*"
        customRequest={upload}
        listType="picture-card"
        showUploadList={false}
      >
        {imageUrl ? <div className="photo-container"><img src={imageUrl} alt="avatar" style={{ width: '100%' }} /></div> : uploadButton}
      </Upload>
      {imageUrl && <Button className="remove-photo" onClick={onRemoveImage}><CloseOutlined /></Button>}
    </div>
  );
}

export default PhotoUpload;
