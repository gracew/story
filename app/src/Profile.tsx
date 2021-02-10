import { Button, Divider, Spin } from "antd";
import firebase from "firebase";
import "firebase/analytics";
import "firebase/remote-config";
import "firebase/storage";
import React, { useState } from "react";
import { useHistory } from "react-router-dom";
import EditPreference, { PreferenceType } from "./EditPreference";
import Preference from "./Preference";
import "./Profile.css";

const user: Record<string, any> = {
  firstName: "Grace",
  gender: "Female",
  age: 28,
  location: "San Francisco Bay Area",
  locationFlexibility: false,
  matchMin: 27,
  matchMax: 35,
  genderPreference: "Men",
  funFacts: "I collect pressed pennies. I lived in Airbnbs in NYC for a year. I want to hike the PCT someday."
};

const userDetailed: Record<string, any> = {
  connectionType: {
    value: "Open to either"
  },
  relationshipType: {
    value: "Open to either"
  },
  politics: {
    value: "Liberal",
    dealbreakers: [],
  },
  religion: {
    value: "Not religious",
    dealbreakers: ["Very religious"],
  },
  drugsAlcohol: {
    value: ["Occasional alcohol drinker"],
    dealbreakers: ["Frequent alcohol drinker"],
  },
  smoking: {
    value: ["No"],
    dealbreakers: ["Yes", "Yes, e-cigarettes"]
  },
  kids: {
    value: ["Want to have kids in the future"],
    dealbreakers: ["Currently have kids", "Don't want to have kids in the future"]
  }
}
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
        "New York City",
        "Los Angeles",
        "San Francisco Bay Area",
        "Seattle",
        "Washington, DC",
      ],
      allowOther: true,
    },
    {
      id: "locationFlexibility",
      label: "Open to matches in other locations",
      type: PreferenceType.BOOLEAN,
      description: "We'll be able to find you more matches if you answer yes!"
    },
    {
      id: "funFacts",
      label: "Fun facts",
      type: PreferenceType.FREE_TEXT,
      description: `These will be shared with your matches, so make them good 🙂

Some ideas:
+ What are you passionate about?
+ How might your friends describe you?
+ What's something you want to learn?
+ What do you take pride in?`,
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
    label: "Relationship type",
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
    options: ["Very religious", "somewhat religious", "Not religious"],
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
  const history = useHistory();

  firebase.auth().onAuthStateChanged(function (user) {
    setUserLoading(false);
    if (!user) {
      history.push("/login")
    }
  });

  async function logout() {
    await firebase.auth().signOut();
    history.push("/login")
  }

  if (userLoading) {
    return <Spin size="large" />
  }

  if (selectedPref) {
    const prefMeta = prefs.basic.find((p: any) => p.id === selectedPref);
    const prefMeta2 = prefs.details.find((p: any) => p.id === selectedPref);
    const detailed = selectedPref in userDetailed;
    const editProps = {
      ...prefMeta,
      ...prefMeta2,
      value: detailed ? userDetailed[selectedPref].value : user[selectedPref],
      dealbreakers: detailed ? userDetailed[selectedPref].dealbreakers : [],
      back: () => setSelectedPref(undefined),
    };
    if (selectedPref === "age") {
      editProps.matchMin = user.matchMin;
      editProps.matchMax = user.matchMax;
    }
    return <div className="profile-container"><EditPreference {...editProps} /></div>
  }
  return (
    <div className="profile-container">
      <div className="profile-header">
        <div>
          <h1>{user.firstName}</h1>
          <h3>{user.gender}, {user.age}</h3>
        </div>
      </div>

      <h3 className="prefs-header">The Basics</h3>

      {prefs.basic.map((pref: any, i: number) => (
        <div>
          { i !== 0 && <Divider />}
          {pref.id !== "age" && <Preference id={pref.id} label={pref.label} value={user[pref.id]} onSelect={setSelectedPref} />}
          {pref.id === "age" && <Preference id={pref.id} label={pref.label} value={`${user["matchMin"]} - ${user["matchMax"]}`} onSelect={setSelectedPref} />}
        </div>
      ))}

      <h3 className="prefs-header">The Details</h3>
      {prefs.details.map((pref: any, i: number) => (
        <div className="detailed-pref">
          {i !== 0 && <Divider />}
          <Preference id={pref.id} label={pref.label} value={userDetailed[pref.id].value} dealbreakers={userDetailed[pref.id].dealbreakers} onSelect={setSelectedPref} />
        </div>
      ))
      }

      <Button className="logout" onClick={logout}>Log out</Button>
    </div>

  );
}

export default Profile;
