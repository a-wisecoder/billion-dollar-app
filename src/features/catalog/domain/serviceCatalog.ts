// Prices and cancel links must be checked by a human before launch.

import type {
  BillingCycle,
  CurrencyCode,
  SubscriptionCategory,
} from '../../cashflow/domain/subscription';

export interface ServiceCatalogEntry {
  readonly id: string;
  readonly name: string;
  readonly aliases: readonly string[];
  readonly category: SubscriptionCategory;
  readonly defaultCycle: BillingCycle;
  readonly typicalPriceMinorUnits?: Partial<Record<CurrencyCode, number>>;
  readonly cancelUrl?: string;
  readonly cancelSteps?: readonly string[];
  readonly lastChecked?: string;
}

/**
 * IDs that have a bundled local SVG icon under public/logos/<id>.svg.
 * All other services fall back to the category-tinted letter avatar (never hotlinked).
 */
export const LOCAL_LOGO_IDS: ReadonlySet<string> = new Set([
  'netflix',
  'spotify',
  'youtube-premium',
  'chatgpt-plus',
  'claude-pro',
  'github-copilot',
  'icloud-plus',
  'google-one',
  'ptcl',
  'stormfiber',
  'nayatel',
  'jazz',
]);

export const SERVICE_CATALOG: readonly ServiceCatalogEntry[] = [
  // --- VIDEO & STREAMING ---
  {
    id: 'netflix',
    name: 'Netflix',
    aliases: ['NETFLIX', 'NETFLIX.COM', 'NFLX', 'NETFLIX INTERNATIONAL'],
    category: 'streaming',
    defaultCycle: 'monthly',
    typicalPriceMinorUnits: { USD: 1549, PKR: 110000, GBP: 1099, EUR: 1399, AED: 4900 },
    cancelUrl: 'https://www.netflix.com/cancelplan',
  },
  {
    id: 'youtube-premium',
    name: 'YouTube Premium',
    aliases: ['YOUTUBE PREMIUM', 'YOUTUBE', 'GOOGLE *YOUTUBE', 'GOOGLE YOUTUBE', 'YT PREMIUM'],
    category: 'streaming',
    defaultCycle: 'monthly',
    typicalPriceMinorUnits: { USD: 1399, PKR: 47900, GBP: 1299, EUR: 1299 },
    cancelUrl: 'https://www.youtube.com/paid_memberships',
  },
  {
    id: 'disney-plus',
    name: 'Disney+',
    aliases: ['DISNEY PLUS', 'DISNEYPLUS', 'DISNEY+'],
    category: 'streaming',
    defaultCycle: 'monthly',
    typicalPriceMinorUnits: { USD: 1599, GBP: 899, EUR: 999 },
    cancelUrl: 'https://www.disneyplus.com/account',
  },
  {
    id: 'amazon-prime-video',
    name: 'Prime Video',
    aliases: ['PRIME VIDEO', 'AMZN PRIME VIDEO', 'PRIMEVIDEO'],
    category: 'streaming',
    defaultCycle: 'monthly',
    typicalPriceMinorUnits: { USD: 899 },
    cancelUrl: 'https://www.primevideo.com/settings',
  },
  {
    id: 'apple-tv-plus',
    name: 'Apple TV+',
    aliases: ['APPLE TV+', 'APPLE TV PLUS', 'APPLE TV'],
    category: 'streaming',
    defaultCycle: 'monthly',
    typicalPriceMinorUnits: { USD: 999, GBP: 899, EUR: 999 },
    cancelUrl: 'https://tv.apple.com/settings',
  },
  {
    id: 'max',
    name: 'Max',
    aliases: ['MAX.COM', 'HBO MAX', 'HBOMAX', 'WARNERMEDIA MAX'],
    category: 'streaming',
    defaultCycle: 'monthly',
    typicalPriceMinorUnits: { USD: 1699 },
    cancelUrl: 'https://auth.max.com/subscription',
  },
  {
    id: 'hulu',
    name: 'Hulu',
    aliases: ['HULU', 'HULU.COM', 'HULUPLUS'],
    category: 'streaming',
    defaultCycle: 'monthly',
    typicalPriceMinorUnits: { USD: 999 },
    cancelUrl: 'https://secure.hulu.com/account',
  },
  {
    id: 'paramount-plus',
    name: 'Paramount+',
    aliases: ['PARAMOUNT+', 'PARAMOUNT PLUS', 'PARAMOUNTPLUS'],
    category: 'streaming',
    defaultCycle: 'monthly',
    typicalPriceMinorUnits: { USD: 799 },
    cancelUrl: 'https://www.paramountplus.com/account/',
  },
  {
    id: 'peacock',
    name: 'Peacock',
    aliases: ['PEACOCK TV', 'PEACOCKTV', 'PEACOCK'],
    category: 'streaming',
    defaultCycle: 'monthly',
    typicalPriceMinorUnits: { USD: 799 },
    cancelUrl: 'https://www.peacocktv.com/account',
  },
  {
    id: 'crunchyroll',
    name: 'Crunchyroll',
    aliases: ['CRUNCHYROLL', 'CRUNCHYROLL.COM'],
    category: 'streaming',
    defaultCycle: 'monthly',
    typicalPriceMinorUnits: { USD: 799 },
    cancelUrl: 'https://www.crunchyroll.com/account/membership',
  },
  {
    id: 'mubi',
    name: 'MUBI',
    aliases: ['MUBI', 'MUBI.COM'],
    category: 'streaming',
    defaultCycle: 'monthly',
    cancelUrl: 'https://mubi.com/settings',
  },
  {
    id: 'vimeo',
    name: 'Vimeo',
    aliases: ['VIMEO', 'VIMEO.COM'],
    category: 'streaming',
    defaultCycle: 'yearly',
    cancelUrl: 'https://vimeo.com/settings/billing',
  },
  {
    id: 'tamasha',
    name: 'Tamasha',
    aliases: ['TAMASHA', 'TAMASHAWEB'],
    category: 'streaming',
    defaultCycle: 'monthly',
    cancelUrl: 'https://tamashaweb.com',
  },
  {
    id: 'tapmad',
    name: 'Tapmad',
    aliases: ['TAPMAD', 'TAPMAD.COM'],
    category: 'streaming',
    defaultCycle: 'monthly',
    cancelUrl: 'https://www.tapmad.com',
  },

  // --- MUSIC & AUDIO ---
  {
    id: 'spotify',
    name: 'Spotify',
    aliases: ['SPOTIFY', 'SPOTIFY.COM', 'SPOTIFY USA', 'SPOTIFY AB', 'SPOTIFY PREMIUM'],
    category: 'music',
    defaultCycle: 'monthly',
    typicalPriceMinorUnits: { USD: 1199, PKR: 34900, GBP: 1199, EUR: 1099, AED: 2199 },
    cancelUrl: 'https://www.spotify.com/account/subscription/',
  },
  {
    id: 'apple-music',
    name: 'Apple Music',
    aliases: ['APPLE MUSIC', 'ITUNES MUSIC'],
    category: 'music',
    defaultCycle: 'monthly',
    typicalPriceMinorUnits: { USD: 1099, GBP: 1099, EUR: 1099 },
    cancelUrl: 'https://music.apple.com',
  },
  {
    id: 'youtube-music',
    name: 'YouTube Music',
    aliases: ['YOUTUBE MUSIC', 'YT MUSIC'],
    category: 'music',
    defaultCycle: 'monthly',
    typicalPriceMinorUnits: { USD: 1099 },
    cancelUrl: 'https://www.youtube.com/paid_memberships',
  },
  {
    id: 'audible',
    name: 'Audible',
    aliases: ['AUDIBLE', 'AUDIBLE.COM', 'AMZN AUDIBLE'],
    category: 'music',
    defaultCycle: 'monthly',
    typicalPriceMinorUnits: { USD: 1495, GBP: 799 },
    cancelUrl: 'https://www.audible.com/account/overview',
  },
  {
    id: 'tidal',
    name: 'TIDAL',
    aliases: ['TIDAL', 'TIDAL.COM'],
    category: 'music',
    defaultCycle: 'monthly',
    typicalPriceMinorUnits: { USD: 1099 },
    cancelUrl: 'https://account.tidal.com',
  },
  {
    id: 'deezer',
    name: 'Deezer',
    aliases: ['DEEZER', 'DEEZER.COM'],
    category: 'music',
    defaultCycle: 'monthly',
    cancelUrl: 'https://www.deezer.com/account/subscription',
  },
  {
    id: 'soundcloud-go',
    name: 'SoundCloud Go+',
    aliases: ['SOUNDCLOUD', 'SOUNDCLOUD GO'],
    category: 'music',
    defaultCycle: 'monthly',
    typicalPriceMinorUnits: { USD: 1099 },
    cancelUrl: 'https://soundcloud.com/settings/subscriptions',
  },
  {
    id: 'pocket-casts',
    name: 'Pocket Casts Plus',
    aliases: ['POCKET CASTS', 'POCKETCASTS'],
    category: 'music',
    defaultCycle: 'yearly',
    cancelUrl: 'https://pocketcasts.com/account',
  },

  // --- AI TOOLS ---
  {
    id: 'chatgpt-plus',
    name: 'ChatGPT Plus',
    aliases: ['OPENAI', 'OPENAI *CHATGPT', 'CHATGPT', 'CHATGPT PLUS', 'OPENAI CHATGPT', 'OPENAI.COM'],
    category: 'aiAndCloud',
    defaultCycle: 'monthly',
    typicalPriceMinorUnits: { USD: 2000 },
    cancelUrl: 'https://chatgpt.com/#settings/Subscription',
  },
  {
    id: 'claude-pro',
    name: 'Claude Pro',
    aliases: ['ANTHROPIC', 'CLAUDE.AI', 'CLAUDE PRO', 'CLAUDE', 'ANTHROPIC CLAUDE'],
    category: 'aiAndCloud',
    defaultCycle: 'monthly',
    typicalPriceMinorUnits: { USD: 2000 },
    cancelUrl: 'https://claude.ai/settings/billing',
  },
  {
    id: 'gemini',
    name: 'Google AI Pro (Gemini)',
    aliases: ['GOOGLE GEMINI', 'GEMINI ADVANCED', 'GOOGLE AI PRO', 'GOOGLE *GOOGLE ONE AI'],
    category: 'aiAndCloud',
    defaultCycle: 'monthly',
    typicalPriceMinorUnits: { USD: 1999 },
    cancelUrl: 'https://one.google.com/settings',
  },
  {
    id: 'github-copilot',
    name: 'GitHub Copilot',
    aliases: ['GITHUB COPILOT', 'GH COPILOT'],
    category: 'aiAndCloud',
    defaultCycle: 'monthly',
    typicalPriceMinorUnits: { USD: 1000 },
    cancelUrl: 'https://github.com/settings/billing',
  },
  {
    id: 'cursor',
    name: 'Cursor',
    aliases: ['CURSOR', 'CURSOR.SH', 'CURSOR.COM', 'CURSOR AI', 'ANYSHERE', 'CURSOR PRO'],
    category: 'aiAndCloud',
    defaultCycle: 'monthly',
    typicalPriceMinorUnits: { USD: 2000 },
    cancelUrl: 'https://www.cursor.com/settings',
  },
  {
    id: 'perplexity-pro',
    name: 'Perplexity Pro',
    aliases: ['PERPLEXITY', 'PERPLEXITY.AI', 'PERPLEXITY PRO'],
    category: 'aiAndCloud',
    defaultCycle: 'monthly',
    typicalPriceMinorUnits: { USD: 2000 },
    cancelUrl: 'https://www.perplexity.ai/settings/account',
  },
  {
    id: 'midjourney',
    name: 'Midjourney',
    aliases: ['MIDJOURNEY', 'MIDJOURNEY.COM'],
    category: 'aiAndCloud',
    defaultCycle: 'monthly',
    typicalPriceMinorUnits: { USD: 1000 },
    cancelUrl: 'https://www.midjourney.com/account',
  },
  {
    id: 'poe',
    name: 'Poe',
    aliases: ['POE.COM', 'QUORA POE', 'POE SUBSCRIPTION'],
    category: 'aiAndCloud',
    defaultCycle: 'monthly',
    typicalPriceMinorUnits: { USD: 1999 },
    cancelUrl: 'https://poe.com/settings',
  },
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    aliases: ['ELEVENLABS', 'ELEVENLABS.IO'],
    category: 'aiAndCloud',
    defaultCycle: 'monthly',
    cancelUrl: 'https://elevenlabs.io/app/subscription',
  },
  {
    id: 'runway',
    name: 'Runway',
    aliases: ['RUNWAYML', 'RUNWAY ML', 'RUNWAY.COM'],
    category: 'aiAndCloud',
    defaultCycle: 'monthly',
    cancelUrl: 'https://app.runwayml.com/settings',
  },

  // --- CLOUD, STORAGE, SECURITY & DEV TOOLS ---
  {
    id: 'icloud-plus',
    name: 'iCloud+',
    aliases: ['ICLOUD', 'ICLOUD+', 'APPLE ICLOUD', 'ICLOUD STORAGE'],
    category: 'aiAndCloud',
    defaultCycle: 'monthly',
    typicalPriceMinorUnits: { USD: 299, GBP: 299, EUR: 299 },
    cancelUrl: 'https://www.icloud.com/settings/',
  },
  {
    id: 'google-one',
    name: 'Google One',
    aliases: ['GOOGLE ONE', 'GOOGLE *GOOGLE ONE', 'GOOGLE STORAGE'],
    category: 'aiAndCloud',
    defaultCycle: 'monthly',
    typicalPriceMinorUnits: { USD: 199, PKR: 20900, GBP: 159, EUR: 199 },
    cancelUrl: 'https://one.google.com/settings',
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    aliases: ['DROPBOX', 'DROPBOX.COM', 'DROPBOX PLUS'],
    category: 'aiAndCloud',
    defaultCycle: 'monthly',
    typicalPriceMinorUnits: { USD: 1199 },
    cancelUrl: 'https://www.dropbox.com/account/plan',
  },
  {
    id: 'github-pro',
    name: 'GitHub Pro',
    aliases: ['GITHUB', 'GITHUB.COM', 'GITHUB PRO', 'GITHUB INC'],
    category: 'aiAndCloud',
    defaultCycle: 'monthly',
    typicalPriceMinorUnits: { USD: 400 },
    cancelUrl: 'https://github.com/settings/billing',
  },
  {
    id: 'aws',
    name: 'Amazon Web Services',
    aliases: ['AWS', 'AMAZON WEB SERVICES', 'AWS EMEA', 'AWS.AMAZON.COM'],
    category: 'aiAndCloud',
    defaultCycle: 'monthly',
    cancelUrl: 'https://console.aws.amazon.com/billing/',
  },
  {
    id: 'vercel-pro',
    name: 'Vercel Pro',
    aliases: ['VERCEL', 'VERCEL INC', 'VERCEL.COM'],
    category: 'aiAndCloud',
    defaultCycle: 'monthly',
    typicalPriceMinorUnits: { USD: 2000 },
    cancelUrl: 'https://vercel.com/account/billing',
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    aliases: ['CLOUDFLARE', 'CLOUDFLARE.COM'],
    category: 'aiAndCloud',
    defaultCycle: 'monthly',
    typicalPriceMinorUnits: { USD: 2000 },
    cancelUrl: 'https://dash.cloudflare.com',
  },
  {
    id: 'digitalocean',
    name: 'DigitalOcean',
    aliases: ['DIGITALOCEAN', 'DIGITALOCEAN.COM'],
    category: 'aiAndCloud',
    defaultCycle: 'monthly',
    cancelUrl: 'https://cloud.digitalocean.com/account/billing',
  },
  {
    id: 'hetzner',
    name: 'Hetzner',
    aliases: ['HETZNER', 'HETZNER ONLINE'],
    category: 'aiAndCloud',
    defaultCycle: 'monthly',
    cancelUrl: 'https://accounts.hetzner.com',
  },
  {
    id: 'supabase-pro',
    name: 'Supabase Pro',
    aliases: ['SUPABASE', 'SUPABASE.COM', 'SUPABASE INC'],
    category: 'aiAndCloud',
    defaultCycle: 'monthly',
    typicalPriceMinorUnits: { USD: 2500 },
    cancelUrl: 'https://supabase.com/dashboard',
  },
  {
    id: 'railway',
    name: 'Railway',
    aliases: ['RAILWAY', 'RAILWAY.APP'],
    category: 'aiAndCloud',
    defaultCycle: 'monthly',
    cancelUrl: 'https://railway.com/account/billing',
  },
  {
    id: 'netlify',
    name: 'Netlify',
    aliases: ['NETLIFY', 'NETLIFY.COM'],
    category: 'aiAndCloud',
    defaultCycle: 'monthly',
    cancelUrl: 'https://app.netlify.com',
  },
  {
    id: 'jetbrains',
    name: 'JetBrains',
    aliases: ['JETBRAINS', 'JETBRAINS.COM'],
    category: 'aiAndCloud',
    defaultCycle: 'yearly',
    cancelUrl: 'https://account.jetbrains.com',
  },
  {
    id: '1password',
    name: '1Password',
    aliases: ['1PASSWORD', '1PASSWORD.COM', 'AGILEBITS'],
    category: 'aiAndCloud',
    defaultCycle: 'yearly',
    cancelUrl: 'https://my.1password.com',
  },
  {
    id: 'bitwarden',
    name: 'Bitwarden',
    aliases: ['BITWARDEN', 'BITWARDEN.COM'],
    category: 'aiAndCloud',
    defaultCycle: 'yearly',
    typicalPriceMinorUnits: { USD: 1000 },
    cancelUrl: 'https://vault.bitwarden.com',
  },
  {
    id: 'proton',
    name: 'Proton',
    aliases: ['PROTON', 'PROTON.ME', 'PROTONMAIL', 'PROTON AG', 'PROTONVPN'],
    category: 'aiAndCloud',
    defaultCycle: 'monthly',
    cancelUrl: 'https://account.proton.me',
  },
  {
    id: 'nordvpn',
    name: 'NordVPN',
    aliases: ['NORDVPN', 'NORDVPN.COM', 'NORD SECURITY'],
    category: 'aiAndCloud',
    defaultCycle: 'yearly',
    cancelUrl: 'https://my.nordaccount.com',
  },
  {
    id: 'expressvpn',
    name: 'ExpressVPN',
    aliases: ['EXPRESSVPN', 'EXPRESSVPN.COM'],
    category: 'aiAndCloud',
    defaultCycle: 'yearly',
    cancelUrl: 'https://www.expressvpn.com/subscriptions',
  },
  {
    id: 'surfshark',
    name: 'Surfshark',
    aliases: ['SURFSHARK', 'SURFSHARK.COM'],
    category: 'aiAndCloud',
    defaultCycle: 'yearly',
    cancelUrl: 'https://my.surfshark.com',
  },
  {
    id: 'backblaze',
    name: 'Backblaze',
    aliases: ['BACKBLAZE', 'BACKBLAZE.COM'],
    category: 'aiAndCloud',
    defaultCycle: 'monthly',
    cancelUrl: 'https://secure.backblaze.com',
  },

  // --- SOFTWARE & PRODUCTIVITY ---
  {
    id: 'microsoft-365',
    name: 'Microsoft 365',
    aliases: ['MICROSOFT 365', 'MSFT 365', 'MICROSOFT*365', 'OFFICE 365', 'MICROSOFT OFFICE'],
    category: 'productivity',
    defaultCycle: 'monthly',
    typicalPriceMinorUnits: { USD: 999 },
    cancelUrl: 'https://account.microsoft.com/services',
  },
  {
    id: 'adobe-creative-cloud',
    name: 'Adobe Creative Cloud',
    aliases: ['ADOBE', 'ADOBE SYSTEMS', 'ADOBE CREATIVE CLOUD', 'ADOBE.COM', 'ADOBE PHOTOSHOP'],
    category: 'productivity',
    defaultCycle: 'monthly',
    cancelUrl: 'https://account.adobe.com/plans',
  },
  {
    id: 'canva-pro',
    name: 'Canva Pro',
    aliases: ['CANVA', 'CANVA.COM', 'CANVA PRO', 'CANVA PTY'],
    category: 'productivity',
    defaultCycle: 'monthly',
    typicalPriceMinorUnits: { USD: 1500 },
    cancelUrl: 'https://www.canva.com/settings/billing-and-teams',
  },
  {
    id: 'notion',
    name: 'Notion',
    aliases: ['NOTION', 'NOTION.SO', 'NOTION LABS', 'NOTION PLUS'],
    category: 'productivity',
    defaultCycle: 'monthly',
    typicalPriceMinorUnits: { USD: 1000 },
    cancelUrl: 'https://www.notion.so',
  },
  {
    id: 'figma',
    name: 'Figma',
    aliases: ['FIGMA', 'FIGMA.COM', 'FIGMA INC'],
    category: 'productivity',
    defaultCycle: 'monthly',
    typicalPriceMinorUnits: { USD: 1500 },
    cancelUrl: 'https://www.figma.com',
  },
  {
    id: 'linkedin-premium',
    name: 'LinkedIn Premium',
    aliases: ['LINKEDIN', 'LINKEDIN PREMIUM', 'LNKD', 'LINKEDIN.COM'],
    category: 'productivity',
    defaultCycle: 'monthly',
    cancelUrl: 'https://www.linkedin.com/mypreferences/d/manage-subscription',
  },
  {
    id: 'grammarly',
    name: 'Grammarly',
    aliases: ['GRAMMARLY', 'GRAMMARLY.COM', 'GRAMMARLY PRO'],
    category: 'productivity',
    defaultCycle: 'yearly',
    cancelUrl: 'https://account.grammarly.com/subscription',
  },
  {
    id: 'slack',
    name: 'Slack',
    aliases: ['SLACK', 'SLACK TECHNOLOGIES', 'SLACK.COM'],
    category: 'productivity',
    defaultCycle: 'monthly',
    cancelUrl: 'https://slack.com/intl/en-us/help',
  },
  {
    id: 'zoom',
    name: 'Zoom',
    aliases: ['ZOOM.US', 'ZOOM VIDEO', 'ZOOM PRO', 'ZOOM'],
    category: 'productivity',
    defaultCycle: 'monthly',
    cancelUrl: 'https://zoom.us/billing',
  },
  {
    id: 'linear',
    name: 'Linear',
    aliases: ['LINEAR', 'LINEAR.APP', 'LINEAR ORBIT'],
    category: 'productivity',
    defaultCycle: 'monthly',
    cancelUrl: 'https://linear.app',
  },
  {
    id: 'miro',
    name: 'Miro',
    aliases: ['MIRO', 'MIRO.COM', 'REALTIMEBOARD'],
    category: 'productivity',
    defaultCycle: 'monthly',
    cancelUrl: 'https://miro.com/app/settings/',
  },
  {
    id: 'todoist',
    name: 'Todoist',
    aliases: ['TODOIST', 'DOIST', 'TODOIST PRO'],
    category: 'productivity',
    defaultCycle: 'yearly',
    cancelUrl: 'https://app.todoist.com/app/settings/subscription',
  },
  {
    id: 'evernote',
    name: 'Evernote',
    aliases: ['EVERNOTE', 'EVERNOTE.COM'],
    category: 'productivity',
    defaultCycle: 'yearly',
    cancelUrl: 'https://www.evernote.com/Settings.action',
  },
  {
    id: 'obsidian-sync',
    name: 'Obsidian Sync',
    aliases: ['OBSIDIAN', 'OBSIDIAN.MD', 'OBSIDIAN SYNC'],
    category: 'productivity',
    defaultCycle: 'monthly',
    typicalPriceMinorUnits: { USD: 500 },
    cancelUrl: 'https://obsidian.md/account',
  },
  {
    id: 'raycast-pro',
    name: 'Raycast Pro',
    aliases: ['RAYCAST', 'RAYCAST.COM'],
    category: 'productivity',
    defaultCycle: 'monthly',
    typicalPriceMinorUnits: { USD: 800 },
    cancelUrl: 'https://raycast.com',
  },
  {
    id: 'loom',
    name: 'Loom',
    aliases: ['LOOM', 'LOOM.COM', 'LOOM INC'],
    category: 'productivity',
    defaultCycle: 'monthly',
    cancelUrl: 'https://www.loom.com/account/billing',
  },
  {
    id: 'calendly',
    name: 'Calendly',
    aliases: ['CALENDLY', 'CALENDLY.COM'],
    category: 'productivity',
    defaultCycle: 'monthly',
    cancelUrl: 'https://calendly.com/app/admin/billing',
  },
  {
    id: 'setapp',
    name: 'Setapp',
    aliases: ['SETAPP', 'SETAPP.COM', 'MACPAW SETAPP'],
    category: 'productivity',
    defaultCycle: 'monthly',
    typicalPriceMinorUnits: { USD: 999 },
    cancelUrl: 'https://my.setapp.com',
  },

  // --- GAMING ---
  {
    id: 'xbox-game-pass',
    name: 'Xbox Game Pass',
    aliases: ['XBOX GAME PASS', 'MICROSOFT*XBOX', 'XBOX LIVE', 'XBOX GAMEPASS'],
    category: 'gaming',
    defaultCycle: 'monthly',
    cancelUrl: 'https://account.microsoft.com/services',
  },
  {
    id: 'playstation-plus',
    name: 'PlayStation Plus',
    aliases: ['PLAYSTATION PLUS', 'PLAYSTATION NETWORK', 'SONY PLAYSTATION', 'PS PLUS', 'PSN'],
    category: 'gaming',
    defaultCycle: 'monthly',
    cancelUrl: 'https://www.playstation.com/acct/management',
  },
  {
    id: 'nintendo-switch-online',
    name: 'Nintendo Switch Online',
    aliases: ['NINTENDO', 'NINTENDO SWITCH ONLINE', 'NINTENDO OF AMERICA'],
    category: 'gaming',
    defaultCycle: 'yearly',
    typicalPriceMinorUnits: { USD: 1999 },
    cancelUrl: 'https://ec.nintendo.com/my/membership',
  },
  {
    id: 'discord-nitro',
    name: 'Discord Nitro',
    aliases: ['DISCORD', 'DISCORD NITRO', 'DISCORD.COM'],
    category: 'gaming',
    defaultCycle: 'monthly',
    typicalPriceMinorUnits: { USD: 999 },
    cancelUrl: 'https://discord.com/app',
  },
  {
    id: 'ea-play',
    name: 'EA Play',
    aliases: ['EA PLAY', 'ELECTRONIC ARTS', 'EA.COM'],
    category: 'gaming',
    defaultCycle: 'monthly',
    typicalPriceMinorUnits: { USD: 599 },
    cancelUrl: 'https://myaccount.ea.com',
  },
  {
    id: 'apple-arcade',
    name: 'Apple Arcade',
    aliases: ['APPLE ARCADE'],
    category: 'gaming',
    defaultCycle: 'monthly',
    typicalPriceMinorUnits: { USD: 699 },
    cancelUrl: 'https://www.apple.com/apple-arcade/',
  },
  {
    id: 'geforce-now',
    name: 'GeForce NOW',
    aliases: ['GEFORCE NOW', 'NVIDIA GEFORCE NOW'],
    category: 'gaming',
    defaultCycle: 'monthly',
    cancelUrl: 'https://www.nvidia.com/en-us/account/',
  },

  // --- NEWS & READING ---
  {
    id: 'nyt',
    name: 'The New York Times',
    aliases: ['NYTIMES', 'NEW YORK TIMES', 'NYT DIGITAL', 'NYTIMES.COM'],
    category: 'news',
    defaultCycle: 'monthly',
    cancelUrl: 'https://myaccount.nytimes.com/seg/subscription',
  },
  {
    id: 'economist',
    name: 'The Economist',
    aliases: ['THE ECONOMIST', 'ECONOMIST.COM'],
    category: 'news',
    defaultCycle: 'yearly',
    cancelUrl: 'https://myaccount.economist.com',
  },
  {
    id: 'medium',
    name: 'Medium',
    aliases: ['MEDIUM', 'MEDIUM.COM', 'MEDIUM CORPORATION'],
    category: 'news',
    defaultCycle: 'monthly',
    typicalPriceMinorUnits: { USD: 500 },
    cancelUrl: 'https://medium.com/me/settings/membership',
  },
  {
    id: 'substack',
    name: 'Substack',
    aliases: ['SUBSTACK', 'SUBSTACK.COM'],
    category: 'news',
    defaultCycle: 'monthly',
    cancelUrl: 'https://substack.com/settings',
  },
  {
    id: 'kindle-unlimited',
    name: 'Kindle Unlimited',
    aliases: ['KINDLE UNLIMITED', 'AMZN KINDLE UNL'],
    category: 'news',
    defaultCycle: 'monthly',
    typicalPriceMinorUnits: { USD: 1199 },
    cancelUrl: 'https://www.amazon.com/kindle-dbs/hz/my-ku-central',
  },
  {
    id: 'ft',
    name: 'Financial Times',
    aliases: ['FINANCIAL TIMES', 'FT.COM'],
    category: 'news',
    defaultCycle: 'monthly',
    cancelUrl: 'https://www.ft.com/myaccount',
  },
  {
    id: 'dawn-epaper',
    name: 'Dawn ePaper',
    aliases: ['DAWN EPAPER', 'DAWN.COM'],
    category: 'news',
    defaultCycle: 'monthly',
    cancelUrl: 'https://epaper.dawn.com',
  },

  // --- LEARNING ---
  {
    id: 'duolingo',
    name: 'Duolingo',
    aliases: ['DUOLINGO', 'DUOLINGO SUPER', 'DUOLINGO MAX', 'DUOLINGO.COM'],
    category: 'education',
    defaultCycle: 'monthly',
    cancelUrl: 'https://www.duolingo.com/settings/subscription',
  },
  {
    id: 'coursera-plus',
    name: 'Coursera Plus',
    aliases: ['COURSERA', 'COURSERA.ORG', 'COURSERA PLUS'],
    category: 'education',
    defaultCycle: 'monthly',
    cancelUrl: 'https://www.coursera.org/my-purchases',
  },
  {
    id: 'brilliant',
    name: 'Brilliant',
    aliases: ['BRILLIANT', 'BRILLIANT.ORG'],
    category: 'education',
    defaultCycle: 'yearly',
    cancelUrl: 'https://brilliant.org/account/',
  },
  {
    id: 'skillshare',
    name: 'Skillshare',
    aliases: ['SKILLSHARE', 'SKILLSHARE.COM'],
    category: 'education',
    defaultCycle: 'yearly',
    cancelUrl: 'https://www.skillshare.com/settings/payments',
  },
  {
    id: 'masterclass',
    name: 'MasterClass',
    aliases: ['MASTERCLASS', 'MASTERCLASS.COM'],
    category: 'education',
    defaultCycle: 'yearly',
    cancelUrl: 'https://www.masterclass.com/account',
  },
  {
    id: 'udemy',
    name: 'Udemy Personal Plan',
    aliases: ['UDEMY', 'UDEMY.COM'],
    category: 'education',
    defaultCycle: 'monthly',
    cancelUrl: 'https://www.udemy.com/user/manage-subscriptions/',
  },

  // --- FITNESS & HEALTH ---
  {
    id: 'strava',
    name: 'Strava',
    aliases: ['STRAVA', 'STRAVA.COM'],
    category: 'health',
    defaultCycle: 'yearly',
    cancelUrl: 'https://www.strava.com/account',
  },
  {
    id: 'peloton',
    name: 'Peloton',
    aliases: ['PELOTON', 'ONEPELOTON'],
    category: 'health',
    defaultCycle: 'monthly',
    cancelUrl: 'https://members.onepeloton.com/preferences/subscriptions',
  },
  {
    id: 'apple-fitness-plus',
    name: 'Apple Fitness+',
    aliases: ['APPLE FITNESS+', 'APPLE FITNESS PLUS'],
    category: 'health',
    defaultCycle: 'monthly',
    typicalPriceMinorUnits: { USD: 999 },
    cancelUrl: 'https://www.apple.com/apple-fitness-plus/',
  },
  {
    id: 'headspace',
    name: 'Headspace',
    aliases: ['HEADSPACE', 'HEADSPACE.COM'],
    category: 'health',
    defaultCycle: 'monthly',
    cancelUrl: 'https://www.headspace.com/subscription/manage',
  },
  {
    id: 'calm',
    name: 'Calm',
    aliases: ['CALM.COM', 'CALM APP'],
    category: 'health',
    defaultCycle: 'yearly',
    cancelUrl: 'https://www.calm.com/profile/manage-subscription',
  },
  {
    id: 'whoop',
    name: 'WHOOP',
    aliases: ['WHOOP', 'WHOOP.COM'],
    category: 'health',
    defaultCycle: 'monthly',
    cancelUrl: 'https://app.whoop.com/membership',
  },
  {
    id: 'planet-fitness',
    name: 'Planet Fitness',
    aliases: ['PLANET FITNESS', 'PLNT FITNESS'],
    category: 'health',
    defaultCycle: 'monthly',
    cancelUrl: 'https://www.planetfitness.com/my-account',
  },

  // --- PHONE & INTERNET (GLOBAL + PAKISTAN) ---
  {
    id: 'ptcl',
    name: 'PTCL',
    aliases: ['PTCL', 'PTCL FLASH FIBER', 'PTCL BROADBAND', 'PAKISTAN TELECOM'],
    category: 'phoneInternet',
    defaultCycle: 'monthly',
    cancelUrl: 'https://ptcl.com.pk',
  },
  {
    id: 'stormfiber',
    name: 'StormFiber',
    aliases: ['STORMFIBER', 'STORM FIBER', 'CYBERNET STORMFIBER'],
    category: 'phoneInternet',
    defaultCycle: 'monthly',
    cancelUrl: 'https://my.stormfiber.com',
  },
  {
    id: 'nayatel',
    name: 'Nayatel',
    aliases: ['NAYATEL', 'NAYATEL PVT'],
    category: 'phoneInternet',
    defaultCycle: 'monthly',
    cancelUrl: 'https://customer.nayatel.com',
  },
  {
    id: 'jazz',
    name: 'Jazz',
    aliases: ['JAZZ', 'JAZZ POSTPAID', 'MOBILINK', 'PMCL JAZZ'],
    category: 'phoneInternet',
    defaultCycle: 'monthly',
    cancelUrl: 'https://jazz.com.pk',
  },
  {
    id: 'zong',
    name: 'Zong',
    aliases: ['ZONG', 'ZONG 4G', 'CMPak', 'ZONG POSTPAID'],
    category: 'phoneInternet',
    defaultCycle: 'monthly',
    cancelUrl: 'https://www.zong.com.pk',
  },
  {
    id: 'telenor',
    name: 'Telenor',
    aliases: ['TELENOR', 'TELENOR PAKISTAN', 'TELENOR POSTPAID'],
    category: 'phoneInternet',
    defaultCycle: 'monthly',
    cancelUrl: 'https://www.telenor.com.pk',
  },
  {
    id: 'ufone',
    name: 'Ufone',
    aliases: ['UFONE', 'UFONE 4G', 'PTML UFONE', 'UFONE POSTPAID'],
    category: 'phoneInternet',
    defaultCycle: 'monthly',
    cancelUrl: 'https://www.ufone.com',
  },
  {
    id: 'transworld',
    name: 'Transworld Home',
    aliases: ['TRANSWORLD', 'TRANSWORLD HOME', 'TW1'],
    category: 'phoneInternet',
    defaultCycle: 'monthly',
    cancelUrl: 'https://twhome.com.pk',
  },
  {
    id: 'att',
    name: 'AT&T',
    aliases: ['AT&T', 'ATT WIRELESS', 'ATT BILL PAYMENT', 'ATT FIBER'],
    category: 'phoneInternet',
    defaultCycle: 'monthly',
    cancelUrl: 'https://www.att.com/my/',
  },
  {
    id: 'verizon',
    name: 'Verizon',
    aliases: ['VERIZON', 'VERIZON WIRELESS', 'VZWRLSS'],
    category: 'phoneInternet',
    defaultCycle: 'monthly',
    cancelUrl: 'https://www.verizon.com/my-verizon/',
  },
  {
    id: 't-mobile',
    name: 'T-Mobile',
    aliases: ['T-MOBILE', 'TMOBILE', 'T MOBILE'],
    category: 'phoneInternet',
    defaultCycle: 'monthly',
    cancelUrl: 'https://www.t-mobile.com/account',
  },
  {
    id: 'xfinity',
    name: 'Xfinity',
    aliases: ['XFINITY', 'COMCAST', 'COMCAST XFINITY'],
    category: 'phoneInternet',
    defaultCycle: 'monthly',
    cancelUrl: 'https://customer.xfinity.com',
  },

  // --- SHOPPING MEMBERSHIPS ---
  {
    id: 'amazon-prime',
    name: 'Amazon Prime',
    aliases: ['AMAZON PRIME', 'AMZN PRIME', 'PRIME MEMBER', 'AMAZON PRIME MEMBERSHIP'],
    category: 'shopping',
    defaultCycle: 'monthly',
    typicalPriceMinorUnits: { USD: 1499, GBP: 899, EUR: 899, AED: 1600 },
    cancelUrl: 'https://www.amazon.com/mc/pipelines/cancellation',
  },
  {
    id: 'apple-one',
    name: 'Apple One',
    aliases: ['APPLE ONE', 'APPLE.COM/BILL ONE'],
    category: 'shopping',
    defaultCycle: 'monthly',
    typicalPriceMinorUnits: { USD: 1995, GBP: 1895, EUR: 1995 },
    cancelUrl: 'https://www.apple.com/apple-one/',
  },
  {
    id: 'costco',
    name: 'Costco Membership',
    aliases: ['COSTCO MEMBERSHIP', 'COSTCO ANNUAL'],
    category: 'shopping',
    defaultCycle: 'yearly',
    cancelUrl: 'https://www.costco.com/AccountInformationView',
  },
  {
    id: 'walmart-plus',
    name: 'Walmart+',
    aliases: ['WALMART+', 'WALMART PLUS', 'WMT PLUS'],
    category: 'shopping',
    defaultCycle: 'monthly',
    typicalPriceMinorUnits: { USD: 1295 },
    cancelUrl: 'https://www.walmart.com/account/plus/manage',
  },

  // --- FOOD DELIVERY ---
  {
    id: 'foodpanda-pro',
    name: 'foodpanda pro',
    aliases: ['FOODPANDA PRO', 'PANDAPRO', 'FOODPANDA SUBSCRIPTION'],
    category: 'food',
    defaultCycle: 'monthly',
    cancelUrl: 'https://www.foodpanda.pk',
  },
  {
    id: 'uber-one',
    name: 'Uber One',
    aliases: ['UBER ONE', 'UBER PASS', 'UBER *ONE'],
    category: 'food',
    defaultCycle: 'monthly',
    typicalPriceMinorUnits: { USD: 999, GBP: 499 },
    cancelUrl: 'https://www.uber.com',
  },
  {
    id: 'doordash-dashpass',
    name: 'DoorDash DashPass',
    aliases: ['DOORDASH DASHPASS', 'DASHPASS', 'DD DASHPASS'],
    category: 'food',
    defaultCycle: 'monthly',
    typicalPriceMinorUnits: { USD: 999 },
    cancelUrl: 'https://www.doordash.com/consumer/dashpass/manage/',
  },
  {
    id: 'deliveroo-plus',
    name: 'Deliveroo Plus',
    aliases: ['DELIVEROO PLUS', 'DELIVEROO+'],
    category: 'food',
    defaultCycle: 'monthly',
    cancelUrl: 'https://deliveroo.co.uk/account',
  },
  {
    id: 'careem-plus',
    name: 'Careem Plus',
    aliases: ['CAREEM PLUS', 'CAREEM+'],
    category: 'food',
    defaultCycle: 'monthly',
    cancelUrl: 'https://www.careem.com',
  },

  // --- FINANCE & OTHER ---
  {
    id: 'ynab',
    name: 'YNAB',
    aliases: ['YNAB', 'YOU NEED A BUDGET', 'YNAB.COM'],
    category: 'finance',
    defaultCycle: 'yearly',
    cancelUrl: 'https://app.ynab.com',
  },
  {
    id: 'tradingview',
    name: 'TradingView',
    aliases: ['TRADINGVIEW', 'TRADINGVIEW.COM'],
    category: 'finance',
    defaultCycle: 'monthly',
    cancelUrl: 'https://www.tradingview.com/settings/#billing',
  },
  {
    id: 'patreon',
    name: 'Patreon',
    aliases: ['PATREON', 'PATREON.COM', 'PATREON* MEMBERSHIP'],
    category: 'other',
    defaultCycle: 'monthly',
    cancelUrl: 'https://www.patreon.com/settings/memberships',
  },
  {
    id: 'ring-protect',
    name: 'Ring Home',
    aliases: ['RING PROTECT', 'RING.COM', 'RING HOME'],
    category: 'utilities',
    defaultCycle: 'monthly',
    cancelUrl: 'https://account.ring.com',
  },
  {
    id: 'nest-aware',
    name: 'Google Nest Aware',
    aliases: ['NEST AWARE', 'GOOGLE NEST AWARE'],
    category: 'utilities',
    defaultCycle: 'monthly',
    cancelUrl: 'https://store.google.com/subscriptions',
  },
];

const CATALOG_BY_ID = new Map<string, ServiceCatalogEntry>(
  SERVICE_CATALOG.map((entry) => [entry.id, entry]),
);

const PAKISTAN_FEATURED_IDS = [
  'netflix',
  'spotify',
  'youtube-premium',
  'chatgpt-plus',
  'ptcl',
  'stormfiber',
  'nayatel',
  'jazz',
  'zong',
  'telenor',
  'ufone',
  'foodpanda-pro',
  'google-one',
  'icloud-plus',
  'claude-pro',
  'canva-pro',
];

const GLOBAL_FEATURED_IDS = [
  'netflix',
  'spotify',
  'youtube-premium',
  'chatgpt-plus',
  'amazon-prime',
  'icloud-plus',
  'google-one',
  'claude-pro',
  'microsoft-365',
  'disney-plus',
  'apple-one',
  'github-copilot',
  'cursor',
  'notion',
  'figma',
  'adobe-creative-cloud',
];

function normalizeForMatch(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9+&. ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface CompiledAlias {
  readonly normalized: string;
  readonly entry: ServiceCatalogEntry;
}

const COMPILED_ALIASES: readonly CompiledAlias[] = (() => {
  const list: CompiledAlias[] = [];
  for (const entry of SERVICE_CATALOG) {
    const candidates = new Set<string>([entry.name, ...entry.aliases]);
    for (const raw of candidates) {
      const normalized = normalizeForMatch(raw);
      if (normalized.length >= 2) {
        list.push({ normalized, entry });
      }
    }
  }
  // Longer aliases match first so "YOUTUBE MUSIC" beats "YOUTUBE" and "GITHUB COPILOT" beats "GITHUB".
  list.sort((a, b) => b.normalized.length - a.normalized.length);
  return list;
})();

export function getCatalogEntryById(id: string | undefined): ServiceCatalogEntry | undefined {
  if (!id) return undefined;
  return CATALOG_BY_ID.get(id);
}

/**
 * Matches a normalized or raw merchant string against catalog aliases.
 * Uses token-boundary matching so short aliases (like "MAX" or "AWS") don't falsely match unrelated words.
 */
export function matchCatalogByMerchant(merchantRaw: string): ServiceCatalogEntry | null {
  const norm = normalizeForMatch(merchantRaw);
  if (!norm) return null;

  // 1. Exact alias or name match
  for (const item of COMPILED_ALIASES) {
    if (norm === item.normalized) {
      return item.entry;
    }
  }

  // 2. Word-boundary substring match (longest specific alias first)
  const padded = ` ${norm} `;
  for (const item of COMPILED_ALIASES) {
    if (item.normalized.length < 3) continue;
    if (padded.includes(` ${item.normalized} `)) {
      return item.entry;
    }
    // Also support domain-like tokens without spaces (e.g. "NETFLIXCOM" or "OPENAI*CHATGPT")
    const compactAlias = item.normalized.replace(/\s+/g, '');
    if (compactAlias.length >= 5 && norm.replace(/\s+/g, '').includes(compactAlias)) {
      return item.entry;
    }
  }

  return null;
}

/**
 * Searches the service catalog by name, alias, or category.
 * When query is empty, surfaces popular services for the user's currency first.
 */
export function searchServiceCatalog(
  query: string,
  options?: {
    readonly category?: SubscriptionCategory | null;
    readonly preferredCurrency?: CurrencyCode;
  },
): ServiceCatalogEntry[] {
  const q = query.trim().toLowerCase();
  const category = options?.category ?? null;
  const featuredList =
    options?.preferredCurrency === 'PKR' ? PAKISTAN_FEATURED_IDS : GLOBAL_FEATURED_IDS;
  const featuredRank = new Map<string, number>(featuredList.map((id, i) => [id, i]));

  const filtered = SERVICE_CATALOG.filter((entry) => {
    if (category && entry.category !== category) return false;
    if (!q) return true;
    if (entry.name.toLowerCase().includes(q)) return true;
    if (entry.id.toLowerCase().includes(q)) return true;
    return entry.aliases.some((alias) => alias.toLowerCase().includes(q));
  });

  if (!q) {
    return [...filtered].sort((a, b) => {
      const rankA = featuredRank.get(a.id) ?? 999;
      const rankB = featuredRank.get(b.id) ?? 999;
      if (rankA !== rankB) return rankA - rankB;
      return a.name.localeCompare(b.name);
    });
  }

  return [...filtered].sort((a, b) => {
    const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1;
    const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1;
    if (aStarts !== bStarts) return aStarts - bStarts;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Infers a SubscriptionCategory from a merchant name.
 * Checks the service catalog first, then domain keywords. Unknown merchants become 'other'.
 */
export function inferCategoryFromMerchantName(name: string): SubscriptionCategory {
  const catalogMatch = matchCatalogByMerchant(name);
  if (catalogMatch) return catalogMatch.category;

  const lower = name.toLowerCase();
  if (/\b(music|spotify|podcast|audio|audible|deezer|tidal|soundcloud)\b/.test(lower)) {
    return 'music';
  }
  if (/\b(netflix|hulu|disney|hbo|cinema|tv|stream|video|prime video|crunchyroll)\b/.test(lower)) {
    return 'streaming';
  }
  if (
    /\b(chatgpt|openai|claude|anthropic|gemini|aws|icloud|cloud|vercel|github|cursor|gpu|dropbox|vpn|hosting|server)\b/.test(
      lower,
    )
  ) {
    return 'aiAndCloud';
  }
  if (/\b(notion|figma|adobe|canva|slack|zoom|office|microsoft 365|workspace|productivity)\b/.test(lower)) {
    return 'productivity';
  }
  if (/\b(xbox|playstation|nintendo|steam|game|gaming|discord|arcade|ea play)\b/.test(lower)) {
    return 'gaming';
  }
  if (/\b(times|economist|news|newspaper|magazine|substack|medium|journal|kindle)\b/.test(lower)) {
    return 'news';
  }
  if (/\b(duolingo|coursera|udemy|skillshare|masterclass|academy|learning|course|school)\b/.test(lower)) {
    return 'education';
  }
  if (/\b(gym|fitness|equinox|peloton|strava|whoop|health|yoga|pilates|crossfit|wellness|recovery club)\b/.test(lower)) {
    return 'health';
  }
  if (
    /\b(ptcl|stormfiber|nayatel|jazz|zong|telenor|ufone|fiber|internet|broadband|mobile|wireless|telecom|verizon|t-mobile|xfinity|at&t)\b/.test(
      lower,
    )
  ) {
    return 'phoneInternet';
  }
  if (/\b(electric|water|gas bill|utility|sewer|trash|ring protect|nest aware)\b/.test(lower)) {
    return 'utilities';
  }
  if (/\b(amazon prime|costco|walmart\+|shopping|membership club|daraz)\b/.test(lower)) {
    return 'shopping';
  }
  if (/\b(foodpanda|ubereats|uber one|doordash|dashpass|deliveroo|careem|meal kit)\b/.test(lower)) {
    return 'food';
  }
  if (/\b(ynab|tradingview|brokerage|bank fee|credit monitor|finance|tax)\b/.test(lower)) {
    return 'finance';
  }
  return 'other';
}
