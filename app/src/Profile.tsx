import { Button, Divider, Spin } from "antd";
import "firebase/analytics";
import "firebase/remote-config";
import "firebase/storage";
import React, { useEffect, useState } from "react";
import "./Profile.css";
import Preference from "./Preference";
import EditPreference, { PreferenceType } from "./EditPreference";

const user: Record<string, any> = {
  firstName: "Grace",
  gender: "Female",
  age: 28,
  location: "San Francisco Bay Area",
  locationFlexibility: false,
  matchMin: 27,
  matchMax: 35,
  genderPreference: "Men",
  phone: "+15714816721",
  funFacts: "I collect pressed pennies. I lived in Airbnbs in NYC for a year. I want to hike the PCT someday."
};

const userDetailed: Record<string, any> = {
  connectionType: {
    value: ["Serious dating", "Casual dating"],
  },
  relationshipType: {
    value: ["Monogamous", "Non-monogamous"],
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
    value: "Occasional alcohol drinker",
    dealbreakers: ["Frequent alcohol drinker"],
  },
  smoking: {
    value: "Not a smoker",
    dealbreakers: ["Smoke", "Use e-cigarettes"]
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
    },
    {
      id: "locationFlexibility",
      label: "Open to matches in other locations",
      type: PreferenceType.MULTIPLE_CHOICE,
      options: ["Yes", "No"]
    },
    {
      id: "funFacts",
      label: "Fun facts",
      type: PreferenceType.FREE_TEXT,
      description: "These will be shared with your matches, so make them good 🙂",
    },
  ],
  details: [{
    id: "connectionType",
    label: "Connection type",
    type: PreferenceType.MULTIPLE_CHOICE_ALLOW_MULTIPLE,
    options: ["Serious dating", "Casual dating"],
  },
  {
    id: "relationshipType",
    label: "Relationship type",
    type: PreferenceType.MULTIPLE_CHOICE_ALLOW_MULTIPLE,
    options: ["Monogamous", "Non-monogamous"],
  },
  {
    id: "politics",
    label: "Politics",
    type: PreferenceType.MULTIPLE_CHOICE,
    options: ["Very liberal", "Liberal", "Moderate", "Conservative", "Very conservative", "I'm not into politics"],
    dealbreakers: true,
    allowOther: true,
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
    dealbreakers: true,
    allowOther: true,
  },
  {
    id: "smoking",
    label: "Smoking",
    type: PreferenceType.MULTIPLE_CHOICE_ALLOW_MULTIPLE,
    options: ["Yes", "Yes, e-cigarettes", "No"],
    dealbreakers: true,
  },
  {
    id: "kids",
    label: "Kids",
    type: PreferenceType.MULTIPLE_CHOICE_ALLOW_MULTIPLE,
    options: ["Currently have kids", "Want to have kids in the future", "Don't want to have kids in the future", "Not sure"],
    dealbreakers: true,
  }],
}

function Profile() {
  const [selectedPref, setSelectedPref] = useState<string>();

  if (selectedPref) {
    const prefMeta = prefs.basic.find((p: any) => p.id === selectedPref);
    const prefMeta2 = prefs.details.find((p: any) => p.id === selectedPref);
    const detailed = selectedPref in userDetailed;
    const editProps = {
      ...prefMeta,
      ...prefMeta2,
      selected: user[selectedPref] || userDetailed[selectedPref].value,
      selectedDealbreakers: detailed ? userDetailed[selectedPref].dealbreakers : [],
      back: () => setSelectedPref(undefined),
    };
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

      <Button className="logout">Log out</Button>
    </div>

  );
}

export default Profile;
