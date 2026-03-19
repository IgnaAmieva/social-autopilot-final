// src/lib/typefully.ts

const TYPEFULLY_API_BASE = 'https://api.typefully.com/v2';

function getApiKey(): string {
  const key = process.env.TYPEFULLY_API_KEY;
  if (!key) throw new Error("Missing TYPEFULLY_API_KEY environment variable");
  return key;
}

export interface TypefullyDraft {
  id: string;
  platforms: {
    x: {
      enabled: boolean;
      posts: Array<{
        text: string;
      }>;
    };
  };
  status: string;
  created_at: string;
  publish_at?: string;
}

export interface TypefullySocialSet {
  id: string;
  username: string;
  name: string;
  profile_image_url: string;
  team: {
    id: string;
    name: string;
  };
}

// Obtener todos los social sets del usuario
export async function getTypefullySocialSets(): Promise<{
  results: TypefullySocialSet[];
  count: number;
}> {
  const response = await fetch(`${TYPEFULLY_API_BASE}/social-sets`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Typefully API error: ${response.statusText}`);
  }

  return response.json();
}

// Crear un draft en Typefully
export async function createTypefullyDraft(
socialSetId: string, content: string, publishAt?: string): Promise<TypefullyDraft> {
  const payload: Record<string, unknown> = {
    platforms: {
      x: {
        enabled: true,
        posts: [
          {
            text: content,
          },
        ],
      },
    },
  };

  if (publishAt) {
    payload.publish_at = publishAt;
  }

  const response = await fetch(
    `${TYPEFULLY_API_BASE}/social-sets/${socialSetId}/drafts`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `Failed to create draft: ${error.message || response.statusText}`
    );
  }

  return response.json();
}

// Publicar un draft inmediatamente
export async function publishTypefullyDraft(
  socialSetId: string,
  draftId: string
): Promise<Record<string, unknown>> {
  const response = await fetch(
    `${TYPEFULLY_API_BASE}/social-sets/${socialSetId}/drafts/${draftId}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        publish_at: 'now',
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to publish draft: ${response.statusText}`);
  }

  return response.json();
}