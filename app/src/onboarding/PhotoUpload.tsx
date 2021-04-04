import { LoadingOutlined, PlusOutlined } from '@ant-design/icons';
import { Upload } from "antd";
import { RcFile, UploadChangeParam } from "antd/lib/upload";
import firebase from 'firebase';
import React, { useState } from "react";
import * as uuid from "uuid";
import "./PhotoUpload.css";

interface PhotoUploadProps {
  update: (path?: string) => void;
}

function PhotoUpload(props: PhotoUploadProps) {
  const [imageUrl, setImageUrl] = useState();
  const [loading, setLoading] = useState(false);

  async function upload(file: RcFile) {
    const path = `photos/${uuid.v4()}`;
    const ref = firebase.storage().ref(path);
    await ref.put(file);
    const url = await ref.getDownloadURL();
    props.update(path);
    setImageUrl(url);
    return url;
  }

  function handleChange(info: UploadChangeParam) {
    if (info.file.status === 'uploading') {
      setLoading(true);
    } else if (info.file.status === 'done') {
      setLoading(false);
    }
  };

  const uploadButton = (
    <div>
      {loading ? <LoadingOutlined /> : <PlusOutlined />}
      <div style={{ marginTop: 8 }}>Upload</div>
    </div>
  );
  return (
    <Upload
      className="photo-upload"
      name="avatar"
      accept="image/*"
      action={upload}
      listType="picture-card"
      showUploadList={false}
      onChange={handleChange}
    >
      {imageUrl ? <img src={imageUrl} alt="avatar" style={{ width: '100%' }} /> : uploadButton}
    </Upload>
  );
}

export default PhotoUpload;
