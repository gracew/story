import { EditOutlined } from "@ant-design/icons";
import { Button, Divider } from "antd";
import firebase from "firebase";
import "firebase/analytics";
import "firebase/remote-config";
import "firebase/storage";
import React, { useEffect, useState } from "react";
import { useHistory, useParams } from "react-router-dom";
import * as uuid from "uuid";
import CenteredSpin from "./CenteredSpin";
import EditPreference, { EditPreferenceProps, PreferenceType } from "./EditPreference";
import Preference from "./Preference";
import "./Profile.css";
import ProfileCard from "./ProfileCard";

const prefs: Record<string, any> = {
  basic: [
    {
      id: "genderPreference",
      label: "Looking to meet",
      type: PreferenceType.MULTIPLE_CHOICE,
      options: ["Men", "Women", "Everyone"]
    },
    {
      id: "age",
      label: "Age range",
      type: PreferenceType.AGE,
    },
    {
      id: "location",
      label: "Location",
      type: PreferenceType.MULTIPLE_CHOICE,
      options: [
        "Boston",
        "Chicago",
        "Los Angeles",
        "New York City",
        "Philadelphia",
        "San Diego",
        "San Francisco Bay Area",
        "Seattle",
        "Toronto",
        "Washington, DC",
      ],
      allowOther: true,
    },
    {
      id: "locationFlexibility",
      label: "Open to matches in other locations",
      type: PreferenceType.MULTIPLE_CHOICE,
      options: ["Yes", "No"],
      description: "We'll be able to find you more matches if you answer yes!"
    },
    {
      id: "funFacts",
      label: "Fun facts",
      type: PreferenceType.FREE_TEXT,
      description: `<p>These will be shared with your matches, so make them good 🙂</p>
<p>Some ideas:</p>
<ul>
<li>What are you passionate about?</li>
<li>How might your friends describe you?</li>
<li>What's something you want to learn?</li>
<li>What do you take pride in?</li>
</ul>
`,
    },
  ],
  details: [{
    id: "connectionType",
    label: "Serious or casual dating",
    type: PreferenceType.MULTIPLE_CHOICE,
    options: ["Serious dating", "Casual dating", "Open to either"],
  },
  {
    id: "relationshipType",
    label: "Mono or poly relationship",
    type: PreferenceType.MULTIPLE_CHOICE,
    options: ["Monogamous", "Non-monogamous", "Open to either"],
  },
  {
    id: "politics",
    label: "Politics",
    type: PreferenceType.MULTIPLE_CHOICE,
    options: ["Very liberal", "Liberal", "Moderate", "Conservative", "Very conservative", "I'm not into politics"],
    allowOther: true,
    dealbreakers: true,
    dealbreakerOptions: ["Very liberal", "Liberal", "Moderate", "Conservative", "Very conservative", "Not into politics"],
  },
  {
    id: "religion",
    label: "Religion",
    type: PreferenceType.MULTIPLE_CHOICE,
    options: ["Very religious", "Somewhat religious", "Not religious"],
    dealbreakers: true,
  },
  {
    id: "drugsAlcohol",
    label: "Drugs & alcohol",
    type: PreferenceType.MULTIPLE_CHOICE_ALLOW_MULTIPLE,
    options: ["Occasional alcohol drinker", "Frequent alcohol drinker", "420 friendly", "I'm adventurous ;)", "I don't drink or use drugs"],
    allowOther: true,
    dealbreakers: true,
    dealbreakerOptions: ["Occasional alcohol drinker", "Frequent alcohol drinker", "420 friendly", "Adventurous ;)", "Don't drink or use drugs"],
  },
  {
    id: "smoking",
    label: "Smoking",
    type: PreferenceType.MULTIPLE_CHOICE_ALLOW_MULTIPLE,
    options: ["Yes", "Yes, e-cigarettes", "No"],
    dealbreakers: true,
    dealbreakerOptions: ["Smoke", "Use e-cigarettes", "Do not smoke"],
  },
  {
    id: "kids",
    label: "Kids",
    type: PreferenceType.MULTIPLE_CHOICE_ALLOW_MULTIPLE,
    options: ["Currently have kids", "Want to have kids in the future", "Don't want to have kids in the future", "Not sure"],
    dealbreakers: true,
    dealbreakerOptions: ["Currently have kids", "Want to have kids in the future", "Don't want to have kids in the future", "Aren't sure if they want kids"],
  }],
}

function Profile() {
  const [userLoading, setUserLoading] = useState(true);
  const [selectedPref, setSelectedPref] = useState<string>();
  const [userPrefs, setUserPrefs] = useState<Record<string, any>>();
  const [photoUploading, setPhotoUploading] = useState(false);
  const history = useHistory();
  const { userId } = useParams();

  useEffect(() => {
    firebase
      .functions()
      .httpsCallable("getPreferences")({ userId })
      .then((res) => {
        setUserPrefs(res.data);
      })
  }, [userLoading, userId]);

  firebase.auth().onAuthStateChanged(function (user) {
    setUserLoading(false);
    if (!user) {
      history.push("/login")
    }
  });

  async function uploadProfilePhoto(files: FileList | null) {
    if (!files || files.length < 1) {
      return;
    }
    setPhotoUploading(true);
    const path = `photos/${uuid.v4()}`;
    const ref = firebase.storage().ref(path);
    await Promise.all([
      ref.put(files[0]),
      firebase
        .functions()
        .httpsCallable("savePreferences")({ photo: path })
    ]);
    setUserPrefs({ ...userPrefs, photo: path });
    setPhotoUploading(false);
  }

  if (userLoading || !userPrefs) {
    return <CenteredSpin />
  }

  if (selectedPref) {
    const prefMeta = prefs.basic.find((p: any) => p.id === selectedPref);
    const prefMeta2 = prefs.details.find((p: any) => p.id === selectedPref);
    const editProps: EditPreferenceProps = {
      metadata: prefMeta || prefMeta2,
      ...userPrefs[selectedPref],
      update: (u: Record<string, any>) => setUserPrefs({ ...userPrefs, ...u }),
      back: () => setSelectedPref(undefined),
    };
    if (selectedPref === "age") {
      editProps.matchMin = userPrefs.matchMin;
      editProps.matchMax = userPrefs.matchMax;
    }
    return <div className="profile-container"><EditPreference {...editProps} /></div>
  }

  return (
    <div className="profile-container">
      <div className="profile-header">
        <div>
          <div className="profile-photo-edit">
            <Button type="text">
              <label htmlFor="profile-photo-upload">
                <EditOutlined />
              </label>
            </Button>
            <input id="profile-photo-upload" type="file" accept="image/*" onChange={e => uploadProfilePhoto(e.target.files)} />
          </div>
          <ProfileCard firstName={userPrefs.firstName} gender={userPrefs.gender} age={userPrefs.age} photoPath={userPrefs.photo} uploading={photoUploading}>
            <div className="profile-card-bottom">Your photo will only be shown after your phone call.</div>
            </ProfileCard>
        </div>
      </div>

      <h3 className="prefs-header">Basics</h3>

      {prefs.basic.map((pref: any, i: number) => (
        <div>
          { i !== 0 && <Divider />}
          {pref.id !== "age" && <Preference id={pref.id} label={pref.label} value={userPrefs[pref.id].value} onSelect={setSelectedPref} />}
          {pref.id === "age" && <Preference id={pref.id} label={pref.label} value={`${userPrefs.matchMin} - ${userPrefs.matchMax}`} onSelect={setSelectedPref} />}
        </div>
      ))}

      <h3 className="prefs-header">The Details</h3>
      {prefs.details.map((pref: any, i: number) => (
        <div className="detailed-pref">
          {i !== 0 && <Divider />}
          <Preference id={pref.id} label={pref.label} value={userPrefs[pref.id]?.value} dealbreakers={userPrefs[pref.id]?.dealbreakers} onSelect={setSelectedPref} />
        </div>
      ))
      }

    </div>

  );
}

export default Profile;
