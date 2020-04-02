import React from "react";
import logo from "../images/webinar-banner.jpg";
const styles = {
  logo: {
    width: "80%"
  },
  main: {
    minHeight: "95vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "calc(10px + 2vmin)",
    textAlign: "center"
  },
  title: {
    fontSize: "2rem"
  },
  container: {
    display: "flex",
    justifyContent: "center",
    maxWidth: "400px"
  },
  description: {
    width: "100%",
    fontSize: "1.2rem"
  }
};
export default function Main() {
  return (
    <main style={styles.main}>
      <img src={logo} style={styles.logo} alt="logo" />
      <h3 style={styles.title}>Food Oasis Los Angeles</h3>
      <section style={styles.container}>
        <article style={styles.description}>
          <p>Welcome to our webinar!</p>
          <p>
            Thank you for helping us verify the data from food pantries + soup
            kitchens in Los Angeles.
          </p>

          <p>
            Food Oasis is a project with{" "}
            <a href="http://hackforla.org">Hack for LA</a>, a brigade of{" "}
            <a href="http://codeforamerica.org">Code for America</a>.
          </p>
        </article>
      </section>
    </main>
  );
}
