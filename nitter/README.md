# Self-Hosted Nitter Session Configuration

Because X (Twitter) has deprecated guest account access, Nitter requires active X account session tokens to scrape profiles and RSS feeds. 

Follow these steps to configure your dummy/secondary accounts:

### 1. Extract Cookies from X.com
1. Open a browser and log in to a secondary/dummy Twitter/X account (do not use your main account to prevent risks of suspensions).
2. Open **Developer Tools** (F12) and go to the **Application** tab (Chrome/Edge) or **Storage** tab (Firefox).
3. Under **Cookies**, select `https://x.com`.
4. Copy the values of the following cookies:
   * **`auth_token`**: A long alphanumeric string representing your session token.
   * **`ct0`**: A 160-character hexadecimal string representing the CSRF token.

### 2. Configure `sessions.jsonl`
1. Open `nitter/sessions.jsonl`.
2. Add your account tokens in JSON Lines format (one JSON object per line):
   ```json
   {"username": "your_account_username", "password": "your_account_password", "auth_token": "PASTE_AUTH_TOKEN_HERE", "ct0": "PASTE_CT0_COOKIE_HERE"}
   ```
3. You can add multiple accounts (one per line) to allow Nitter to rotate and distribute the scraping requests.

### 3. Spin up Containers
Run the following command from the project root to start Nitter and RSS-Bridge:
```bash
docker-compose up -d
```

### 4. Verify & Use
* **Nitter**: Access at `http://localhost:8080` (e.g. `http://localhost:8080/Warlock_mohit/rss` to check RSS).
* **RSS-Bridge**: Access at `http://localhost:3002`.

Once Nitter is verified to be working, you can update the **Nitter Instance URL** in Loiter's settings to `http://localhost:8080` (or `http://loiter-nitter:8080` from inside docker container network) to route scheduled fetches through your private instance!
