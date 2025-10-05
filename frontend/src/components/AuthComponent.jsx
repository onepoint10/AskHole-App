import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Loader2, User, Mail, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

const AuthComponent = ({ onAuthSuccess }) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState('login');
  const [errors, setErrors] = useState({});
  
  const [loginForm, setLoginForm] = useState({
    username: '',
    password: ''
  });
  
  const [registerForm, setRegisterForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  // Clear errors when switching tabs or changing form data
  useEffect(() => {
    setErrors({});
  }, [activeTab]);

  useEffect(() => {
    setErrors({});
  }, [loginForm, registerForm]);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password) => {
    if (password.length < 6) {
      return t('password_too_short');
    }
    if (!/[A-Za-z]/.test(password)) {
      return t('password_must_contain_letter');
    }
    if (!/[0-9]/.test(password)) {
      return t('password_must_contain_number');
    }
    return null;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrors({});
    
    if (!loginForm.username.trim() || !loginForm.password) {
      setErrors({ general: t('please_fill_all_fields') });
      return;
    }

    setIsLoading(true);
    
    try {
      // Dynamic import to ensure we have the latest API
      const { authAPI } = await import('../services/api');
      
      const response = await authAPI.login({
        username: loginForm.username.trim(),
        password: loginForm.password
      });

      console.log('Login response:', response.data);

      // The API client should already handle session storage
      // Just verify we have user data
      if (response.data.user) {
        toast.success(t('login_successful'));
        onAuthSuccess(response.data.user);
      } else {
        throw new Error(t('invalid_response_from_server'));
      }
    } catch (error) {
      console.error('Login error:', error);
      
      // More specific error handling
      let errorMessage = t('login_failed');
      if (error.message.includes('Invalid username')) {
        errorMessage = t('invalid_username_or_password');
      } else if (error.message.includes('Authentication')) {
        errorMessage = t('authentication_failed_try_again');
      } else if (error.message.includes('Network')) {
        errorMessage = t('network_error_check_connection');
      } else {
        errorMessage = error.message || errorMessage;
      }
      
      setErrors({ general: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setErrors({});
    
    const newErrors = {};
    
    // Validation
    if (!registerForm.username.trim()) {
      newErrors.username = t('username_is_required');
    } else if (registerForm.username.trim().length < 3) {
      newErrors.username = t('username_min_length', { length: 3 });
    } else if (registerForm.username.trim().length > 80) {
      newErrors.username = t('username_max_length', { length: 80 });
    }
    
    if (!registerForm.email.trim()) {
      newErrors.email = t('email_is_required');
    } else if (!validateEmail(registerForm.email)) {
      newErrors.email = t('please_enter_valid_email');
    }
    
    const passwordError = validatePassword(registerForm.password);
    if (passwordError) {
      newErrors.password = passwordError;
    }
    
    if (registerForm.password !== registerForm.confirmPassword) {
      newErrors.confirmPassword = t('passwords_do_not_match');
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    
    try {
      // Dynamic import to ensure we have the latest API
      const { authAPI } = await import('../services/api');
      
      const response = await authAPI.register({
        username: registerForm.username.trim(),
        email: registerForm.email.trim().toLowerCase(),
        password: registerForm.password
      });

      console.log('Registration response:', response.data);

      if (response.data.user) {
        toast.success(t('registration_successful_welcome'));
        onAuthSuccess(response.data.user);
      } else {
        throw new Error(t('invalid_response_from_server'));
      }
    } catch (error) {
      console.error('Registration error:', error);
      
      // More specific error handling
      let errorMessage = t('registration_failed');
      if (error.message.includes('Username already exists')) {
        setErrors({ username: t('username_already_exists') });
        return;
      } else if (error.message.includes('Email already registered')) {
        setErrors({ email: t('email_already_registered') });
        return;
      } else if (error.message.includes('Network')) {
        errorMessage = t('network_error_check_connection');
      } else {
        errorMessage = error.message || errorMessage;
      }
      
      setErrors({ general: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    setErrors({});
    // Clear forms when switching tabs for security
    if (newTab === 'login') {
      setRegisterForm({
        username: '',
        email: '',
        password: '',
        confirmPassword: ''
      });
    } else {
      setLoginForm({
        username: '',
        password: ''
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">{t('welcome_to_askhole')}</CardTitle>
          <CardDescription>
            {t('signin_or_create_account')}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">{t('login')}</TabsTrigger>
              <TabsTrigger value="register">{t('register')}</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login" className="space-y-4 mt-6">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder={t('username_or_email')}
                      value={loginForm.username}
                      onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                      className="pl-10"
                      disabled={isLoading}
                      autoComplete="username"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder={t('password')}
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      className="pl-10 pr-10"
                      disabled={isLoading}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
                      disabled={isLoading}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {errors.general && (
                  <Alert variant="destructive">
                    <AlertDescription>{errors.general}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('signing_in')}
                    </>
                  ) : (
                    t('sign_in')
                  )}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="register" className="space-y-4 mt-6">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder={t('username')}
                      value={registerForm.username}
                      onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                      className="pl-10"
                      disabled={isLoading}
                      autoComplete="username"
                    />
                  </div>
                  {errors.username && (
                    <p className="text-sm text-destructive">{errors.username}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder={t('email')}
                      value={registerForm.email}
                      onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                      className="pl-10"
                      disabled={isLoading}
                      autoComplete="email"
                    />
                  </div>
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder={t('password')}
                      value={registerForm.password}
                      onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                      className="pl-10 pr-10"
                      disabled={isLoading}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
                      disabled={isLoading}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-sm text-destructive">{errors.password}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder={t('confirm_password')}
                      value={registerForm.confirmPassword}
                      onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                      className="pl-10"
                      disabled={isLoading}
                      autoComplete="new-password"
                    />
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-sm text-destructive">{errors.confirmPassword}</p>
                  )}
                </div>

                {errors.general && (
                  <Alert variant="destructive">
                    <AlertDescription>{errors.general}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('creating_account')}
                    </>
                  ) : (
                    t('create_account')
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
          
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              {activeTab === 'login' ? t('dont_have_account') : t('already_have_account')}
              <button
                type="button"
                onClick={() => handleTabChange(activeTab === 'login' ? 'register' : 'login')}
                className="text-primary hover:underline font-medium transition-colors"
                disabled={isLoading}
              >
                {activeTab === 'login' ? t('sign_up') : t('sign_in')}
              </button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthComponent;