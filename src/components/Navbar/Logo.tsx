import { useContext } from "react";
import { Link } from "react-router-dom";
import ColorSchemeContext from "@/ColorSchemeContext";
import brandImgUrl from "@/assets/banner-blue.png";
import brandWhiteImgUrl from "@/assets/banner-white.png";

interface LogoBadgeProps {
  size?: string;
  linkTo?: string;
  showText?: boolean;
}

export default function LogoBadge({
  size = "1em",
  linkTo = "/",
  showText = true,
}: LogoBadgeProps) {
  const colorScheme = useContext(ColorSchemeContext);
  const isDark = colorScheme?.colorScheme === "dark";

  return (
    <b>
      <Link
        to={linkTo}
        style={{
          fontSize: size,
          textDecoration: "none",
          color: isDark ? "#F2FDFF" : "#0053B3",
          display: "flex",
          alignItems: "center",
        }}
      >
        <img
          src={isDark ? brandWhiteImgUrl.src : brandImgUrl.src}
          alt="ACM Logo"
          style={{ height: "3em", marginRight: "0.5em" }}
        />
        {showText ? "Print Queue" : null}
      </Link>
    </b>
  );
}
