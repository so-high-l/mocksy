import LoginForm from "./login-form";

export const metadata = {
  title: "Sign in — Mocksy",
};

export default function LoginPage() {
  return <LoginForm localPreview={process.env.NODE_ENV !== "production" && !process.env.APP_PASSWORD} />;
}
