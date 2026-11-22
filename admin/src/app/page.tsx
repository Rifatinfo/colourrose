import { redirect } from "next/navigation";

// The admin app has no storefront landing page. Anyone hitting the root goes
// straight to the dashboard; the middleware/auth guard there bounces them to
// /login if they are not signed in.
const RootPage = () => {
  redirect("/admin");
};

export default RootPage;
