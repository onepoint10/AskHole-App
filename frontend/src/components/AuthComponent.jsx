import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Loader2, User, Mail, Lock } from 'lucide-react';
import { toast } from 'sonner';

const AuthComponent = ({ onAuthSuccess }) => {
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

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password) => {
    if (password.length < 6) {
      return 'Password must be at least 6 characters long';
    }
    if (!/[A-Za-z]/.test(password)) {
      return 'Password must contain at least one letter';
    }
    if (!/[0-9]/.test(password)) {
      return 'Password must contain at least one number';
    }
    return null;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrors({});
    
    if (!loginForm.username.trim() || !loginForm.password) {
      setErrors({ general: 'Please fill in all fields' });
      return;
    }

    setIsLoading(true);
    
    try {
      // Import authAPI dynamically or make sure it's imported at top
      const { authAPI } = await import('../services/api');
      
      const response = await authAPI.login({
        username: loginForm.username.trim(),
        password: loginForm.password
      });

      // Store session_id if provided in response
      if (response.data.session_id) {
        localStorage.setItem('session_id', response.data.session_id);
        // Also set as cookie
        document.cookie = `session=${response.data.session_id}; path=/; max-age=${30*24*60*60}; SameSite=None`;
      }

      toast.success('Login successful!');
      onAuthSuccess(response.data.user);
    } catch (error) {
      console.error('Login error:', error);
      setErrors({ general: error.message || 'Login failed' });
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
      newErrors.username = 'Username is required';
    } else if (registerForm.username.trim().length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }
    
    if (!registerForm.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(registerForm.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    const passwordError = validatePassword(registerForm.password);
    if (passwordError) {
      newErrors.password = passwordError;
    }
    
    if (registerForm.password !== registerForm.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    
    try {
      // Import authAPI dynamically or make sure it's imported at top
      const { authAPI } = await import('../services/api');
      
      const response = await authAPI.register({
        username: registerForm.username.trim(),
        email: registerForm.email.trim().toLowerCase(),
        password: registerForm.password
      });

      toast.success('Registration successful! Welcome!');
      onAuthSuccess(response.data.user);
    } catch (error) {
      console.error('Registration error:', error);
      setErrors({ general: error.message || 'Registration failed' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Welcome to ChatApp</CardTitle>
          <CardDescription>
            Sign in to your account or create a new one
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login" className="space-y-4 mt-6">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Username or email"
                      value={loginForm.username}
                      onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                      className="pl-10"
                      disabled={isLoading}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      className="pl-10 pr-10"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 h-4 w-4 text-muted-foreground hover:text-foreground"
                      disabled={isLoading}
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
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
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
                      placeholder="Username"
                      value={registerForm.username}
                      onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                      className="pl-10"
                      disabled={isLoading}
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
                      placeholder="Email"
                      value={registerForm.email}
                      onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                      className="pl-10"
                      disabled={isLoading}
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
                      placeholder="Password"
                      value={registerForm.password}
                      onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                      className="pl-10 pr-10"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 h-4 w-4 text-muted-foreground hover:text-foreground"
                      disabled={isLoading}
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
                      placeholder="Confirm Password"
                      value={registerForm.confirmPassword}
                      onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                      className="pl-10"
                      disabled={isLoading}
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
                      Creating account...
                    </>
                  ) : (
                    'Create Account'
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
          
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              {activeTab === 'login' ? "Don't have an account? " : "Already have an account? "}
              <button
                type="button"
                onClick={() => {
                  setActiveTab(activeTab === 'login' ? 'register' : 'login');
                  setErrors({});
                }}
                className="text-primary hover:underline font-medium"
                disabled={isLoading}
              >
                {activeTab === 'login' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthComponent;