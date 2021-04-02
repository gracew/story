import { LoadingOutlined, PlusOutlined } from '@ant-design/icons';
import { Upload } from "antd";
import { UploadChangeParam } from "antd/lib/upload";
import React, { useState } from "react";
import "./PhotoUpload.css";

function PhotoUpload() {
  const [imageUrl, setImageUrl] = useState();
  const [loading, setLoading] = useState(false);

  function handleChange(info: UploadChangeParam) {
    if (info.file.status === 'uploading') {
      setLoading(true);
      return;
    }
    if (info.file.status === 'done') {
      // Get this url from response in real world.
      getBase64(info.file.originFileObj, imageUrl => {
        setImageUrl(imageUrl);
        setLoading(false);
      });
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
      name="avatar"
      accept="image/*"
      listType="picture-card"
      showUploadList={false}
    >
      {imageUrl ? <img src={imageUrl} alt="avatar" style={{ width: '100%' }} /> : uploadButton}
    </Upload>
  );
}

export default PhotoUpload;

function getBase64(originFileObj: File | Blob | undefined, arg1: (imageUrl: any) => void) {
  throw new Error("Function not implemented.");
}
