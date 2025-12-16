# Security Hardening Guide

## Immediate Actions Required

### 1. Remove Malware Files
```bash
# SSH into your VPS and run:
sudo rm -rf /opt/pcpcat/
sudo pkill -f frps
sudo pkill -f frpc
sudo pkill -f pcpcat
```

### 2. Check for Backdoors
```bash
# Check for suspicious processes
ps aux | grep -E "frp|pcpcat|miner"

# Check for suspicious network connections
netstat -tulpn | grep -E "frp|pcpcat"

# Check cron jobs
crontab -l
sudo crontab -l

# Check systemd services
systemctl list-units --type=service | grep -E "frp|pcpcat"
```

### 3. Check for Unauthorized Access
```bash
# Check SSH authorized_keys
cat ~/.ssh/authorized_keys
cat /root/.ssh/authorized_keys

# Check recent logins
last
lastlog

# Check for suspicious users
cat /etc/passwd
```

### 4. Secure Your Next.js Application

#### Update Dependencies
```bash
npm audit fix
npm update next react react-dom
```

#### Review Environment Variables
- Ensure `.env` file is not committed to git
- Use strong MongoDB credentials
- Rotate JWT secrets
- Use strong passwords for all services

#### Firewall Configuration
```bash
# Install and configure UFW (if not already installed)
sudo apt update
sudo apt install ufw

# Allow only necessary ports
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### 5. Application Security Checklist

- ✅ File upload endpoint secured (already done)
- ✅ All API routes require authentication
- ✅ Input validation on all endpoints
- ✅ Rate limiting (consider adding)
- ✅ CORS properly configured
- ✅ Environment variables secured

### 6. Server Hardening

#### Update System
```bash
sudo apt update
sudo apt upgrade -y
```

#### Install Security Tools
```bash
sudo apt install fail2ban
sudo apt install rkhunter
sudo apt install chkrootkit
```

#### Configure Fail2Ban
```bash
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

#### Regular Security Audits
```bash
# Run weekly
sudo rkhunter --update
sudo rkhunter --check
sudo chkrootkit
```

### 7. Monitor for Future Attacks

#### Set up Log Monitoring
```bash
# Monitor auth logs
sudo tail -f /var/log/auth.log

# Monitor application logs
pm2 logs  # if using PM2
```

#### Set up Alerts
- Monitor disk usage
- Monitor CPU usage
- Monitor network traffic
- Set up email alerts for failed login attempts

### 8. Backup and Recovery

```bash
# Regular backups
# Backup database
mongodump --out /backup/mongodb-$(date +%Y%m%d)

# Backup application files
tar -czf /backup/app-$(date +%Y%m%d).tar.gz /var/www/possystem
```

## Prevention Measures

1. **Keep software updated**: Regularly update Next.js, Node.js, and system packages
2. **Use strong passwords**: Enforce strong password policies
3. **Limit SSH access**: Use SSH keys instead of passwords, disable root login
4. **Regular security audits**: Run security scans weekly
5. **Monitor logs**: Set up log monitoring and alerts
6. **Backup regularly**: Maintain regular backups of database and files
7. **Use HTTPS**: Ensure all traffic is encrypted
8. **Rate limiting**: Implement rate limiting on API endpoints
9. **Input validation**: Validate and sanitize all user inputs
10. **Principle of least privilege**: Give users only necessary permissions

## Emergency Contacts

- VPS Provider Support
- Security Team
- Backup Recovery Procedures

