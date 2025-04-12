document.addEventListener('DOMContentLoaded', function() {
    // Login form handling
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const submitBtn = this.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = 'Logging in...';
            
            try {
                const response = await fetch('/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams(new FormData(this))
                });
                
                const data = await response.json();
                
                if (data.success) {
                    showMessage('Login successful! Redirecting...', 'success');
                    setTimeout(() => {
                        window.location.href = data.redirect;
                    }, 1000);
                } else {
                    showMessage(data.message || 'Invalid username or password', 'error');
                }
            } catch (error) {
                showMessage('An error occurred during login', 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });
    }
  
    // Form submission handling for all other forms
    document.querySelectorAll('form:not(#loginForm)').forEach(form => {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Check if user is logged in
            try {
                const authCheck = await fetch('/check-auth');
                const authData = await authCheck.json();
                
                if (!authData.logged_in) {
                    showMessage('Session expired. Please login again.', 'error');
                    setTimeout(() => {
                        window.location.href = '/';
                    }, 1500);
                    return;
                }
            } catch (error) {
                showMessage('Authentication check failed', 'error');
                return;
            }
            
            const submitBtn = this.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = 'Saving...';
            
            try {
                const response = await fetch(this.action || window.location.pathname, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams(new FormData(this))
                });
                
                const data = await response.json();
                
                if (data.success) {
                    showMessage(data.message, 'success');
                    if (form.dataset.reset !== 'false') {
                        setTimeout(() => form.reset(), 1500);
                    }
                } else {
                    showMessage(data.message, 'error');
                }
            } catch (error) {
                showMessage('Failed to save data. Please try again.', 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });
    });
  
    // Show notification messages
    function showMessage(text, type) {
        let messageDiv = document.getElementById('message');
        if (!messageDiv) {
            messageDiv = document.createElement('div');
            messageDiv.id = 'message';
            document.body.appendChild(messageDiv);
        }
        
        messageDiv.textContent = text;
        messageDiv.className = `message ${type}`;
        messageDiv.style.display = 'block';
        
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 5000);
    }
  
    // Dashboard animations
    if (document.querySelector('.dashboard-container')) {
        const cards = document.querySelectorAll('.card');
        cards.forEach((card, index) => {
            card.style.animationDelay = `${index * 0.1}s`;
        });
    }
  
    // Auto-logout after 30 minutes of inactivity
    let inactivityTimer;
    function resetInactivityTimer() {
        clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(() => {
            fetch('/logout')
                .then(() => {
                    window.location.href = '/';
                });
        }, 30 * 60 * 1000); // 30 minutes
    }
  
    // Set up event listeners for activity
    ['mousemove', 'keypress', 'click'].forEach(event => {
        document.addEventListener(event, resetInactivityTimer);
    });
  
    resetInactivityTimer();
  }
);