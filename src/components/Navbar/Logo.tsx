import { useComputedColorScheme } from "@mantine/core";
import { Link } from "react-router-dom";
import brandImgUrl from "@/assets/banner-blue.png";
import brandWhiteImgUrl from "@/assets/banner-white.png";

interface LogoBadgeProps {
  linkTo?: string;
}

export default function LogoBadge({ linkTo = "/" }: LogoBadgeProps) {
  const isDark = useComputedColorScheme("light") === "dark";

  return (
    <Link
      to={linkTo}
      style={{
        color: isDark ? "#f2fdff" : "#0053b3",
        display: "flex",
        alignItems: "center",
        fontWeight: 700,
        textDecoration: "none",
      }}
    >
      <img
        src={isDark ? brandWhiteImgUrl.src : brandImgUrl.src}
        alt="ACM Logo"
        style={{ height: "3em", marginRight: "0.5em" }}
      />
      Print Queue
    </Link>
  );
}
