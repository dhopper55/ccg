import { useNavigate } from "react-router";
import { useAuth } from "providers/AuthProvider";
import { rootPaths } from "routes/paths";
import LoginForm, { LoginFormValues } from "components/sections/authentications/default/LoginForm";

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (data: LoginFormValues) => {
    await login(data);
    navigate(rootPaths.root);
  };

  return (
    <LoginForm
      handleLogin={handleLogin}
      provider="jwt"
      emailLabel="Username"
      emailType="text"
      emailAutoComplete="username"
      emailValidation="text"
      signUpLink=""
      socialAuth={false}
      rememberDevice={false}
      showSignUpPrompt={false}
      supportLink={null}
    />
  );
};

export default Login;
