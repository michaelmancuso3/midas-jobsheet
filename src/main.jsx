import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import CheckIn from "./CheckIn.jsx";
import Done from "./Done.jsx";

const path = window.location.pathname.replace(/\/+$/, "");
const Component =
  path === "/done"    ? Done    :
  path === "/checkin" ? CheckIn :
  App;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Component />
  </React.StrictMode>
);
