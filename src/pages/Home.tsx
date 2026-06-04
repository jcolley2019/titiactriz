import HomeClassic from "./HomeClassic";
import HomeEditorial from "./HomeEditorial";

// Switch the home route by changing this one word: "editorial" | "classic".
export const HOME_VARIANT: "editorial" | "classic" = "editorial";

const Home = () => (HOME_VARIANT === "editorial" ? <HomeEditorial /> : <HomeClassic />);

export default Home;
