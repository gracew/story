import { EditOutlined } from "@ant-design/icons";
import * as FullStory from '@fullstory/browser';
import { Button, Divider } from "antd";
import firebase from "firebase";
import "firebase/storage";
import React, { useEffect, useState } from "react";
import { useHistory, useParams } from "react-router-dom";
import * as uuid from "uuid";
import CenteredSpin from "../components/CenteredSpin";
import EditPreference, { EditPreferenceProps, PreferenceType } from "./EditPreference";
import Preference from "./Preference";
import "./Profile.css";
import ProfileCard from "./ProfileCard";
import ReferralCard from "./ReferralCard";

export const LOCATIONS =
  [
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
  ];
export const FUN_FACTS_DESCRIPTION = `<p>These will be shared with your matches, so make them good 🙂</p>
<p>Some ideas:</p>
<ul>
<li>What are you passionate about?</li>
<li>How might your friends describe you?</li>
<li>What's something you want to learn?</li>
<li>What do you take pride in?</li>
</ul>
`

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
      options: LOCATIONS,
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
      description: FUN_FACTS_DESCRIPTION,
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
  const [selectedPref, setSelectedPref] = useState<string>();
  const [userPrefs, setUserPrefs] = useState<Record<string, any>>();
  const [photoUrl, setPhotoUrl] = useState<string>();
  const [photoUploading, setPhotoUploading] = useState(false);
  const history = useHistory();
  // @ts-ignore
  const { userId } = useParams();

  const userPrefsPhoto = userPrefs?.photo;

  useEffect(() => {
    firebase
      .functions()
      .httpsCallable("getPreferences")({ userId })
      .then((res) => {
        setUserPrefs(res.data);
        FullStory.identify(res.data.id, {
          displayName: res.data.firstName,
        });
      })
      .catch((err) => {
        if (err.code === "not-found") {
          // the user logged in, but we don't have an entry for them, so redirect to signup
          history.push("/signup")
        } else {
          throw err;
        }
      })
  }, [userId, history]);

  useEffect(() => {
    if (userPrefsPhoto) {
      firebase
        .storage()
        .ref(userPrefsPhoto)
        .getDownloadURL()
        .then((url) => setPhotoUrl(url));
    }
  }, [userPrefsPhoto]);

  function formatAgeRange() {
    const min = userPrefs!.matchMin;
    const max = userPrefs!.matchMax;
    if (!min && !max) {
      return undefined;
    }
    if (!min) {
      return `${max} and under`;
    }
    if (!max) {
      return `${min} and over`;
    }
    return `${min} - ${max}`;
  }

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

  if (!userPrefs) {
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
          <ProfileCard firstName={userPrefs.firstName} gender={userPrefs.gender} age={userPrefs.age} photoUrl={photoUrl} uploading={photoUploading}>
            <div className="profile-card-bottom">Your photo will only be shown to your match after your phone call.</div>
          </ProfileCard>
        </div>
      </div>

      <ReferralCard referrerId={userPrefs.id} />

      <h3 className="prefs-header">Basics</h3>

      {prefs.basic.map((pref: any, i: number) => (
        <div key={pref.id}>
          { i !== 0 && <Divider />}
          {pref.id !== "age" && <Preference id={pref.id} label={pref.label} value={userPrefs[pref.id].value} onSelect={setSelectedPref} />}
          {pref.id === "age" && <Preference id={pref.id} label={pref.label} value={formatAgeRange()} onSelect={setSelectedPref} />}
        </div>
      ))}

      <h3 className="prefs-header">The Details</h3>
      {prefs.details.map((pref: any, i: number) => (
        <div className="detailed-pref" key={pref.id}>
          {i !== 0 && <Divider />}
          <Preference id={pref.id} label={pref.label} value={userPrefs[pref.id]?.value} dealbreakers={userPrefs[pref.id]?.dealbreakers} onSelect={setSelectedPref} />
        </div>
      ))
      }

    </div>

  );
}

export default Profile;
