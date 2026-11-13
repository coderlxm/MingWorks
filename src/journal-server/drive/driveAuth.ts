import { Auth } from 'googleapis';

export class JournalNoRetryOAuth2Client extends Auth.OAuth2Client {
  constructor(options: Auth.OAuth2ClientOptions) {
    super({
      ...options,
      forceRefreshOnFailure: false,
      transporterOptions: { retry: false },
    });
  }

  protected override async refreshTokenNoCache(refreshToken?: string | null) {
    if (!refreshToken) throw new Error('No refresh token is set.');
    if (!this._clientId || !this._clientSecret) {
      throw new Error('Google OAuth client credentials are not configured.');
    }

    const options = {
      retry: false,
      signal: AbortSignal.timeout(15_000),
      method: 'POST' as const,
      url: this.endpoints.oauth2TokenUrl.toString(),
      data: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: this._clientId,
        client_secret: this._clientSecret,
        grant_type: 'refresh_token',
      }),
    };
    Auth.AuthClient.setMethodName(options, 'refreshTokenNoCache');
    const response = await this.transporter.request<
      Auth.Credentials & { expires_in?: number }
    >(options);
    const tokens = response.data;
    if (tokens.expires_in) {
      tokens.expiry_date = Date.now() + tokens.expires_in * 1000;
      delete tokens.expires_in;
    }
    this.emit('tokens', tokens);
    return { tokens, res: response };
  }
}

