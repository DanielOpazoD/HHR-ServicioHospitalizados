import { describe, expect, it } from 'vitest';

import {
  buildUserAvatarFeedback,
  calculateCenteredAvatarCrop,
} from '@/components/layout/userAvatarImageController';

describe('userAvatarImageController', () => {
  it('centers a landscape image into a square avatar crop', () => {
    expect(calculateCenteredAvatarCrop({ width: 1200, height: 800 })).toEqual({
      sourceX: 200,
      sourceY: 0,
      sourceSize: 800,
    });
  });

  it('centers a portrait image into a square avatar crop', () => {
    expect(calculateCenteredAvatarCrop({ width: 600, height: 900 })).toEqual({
      sourceX: 0,
      sourceY: 150,
      sourceSize: 600,
    });
  });

  it('builds concise toast feedback for save and delete outcomes', () => {
    expect(buildUserAvatarFeedback('saved')).toEqual({
      title: 'Foto de perfil actualizada',
      message: 'Tu foto quedó sincronizada para este usuario.',
    });
    expect(buildUserAvatarFeedback('removed')).toEqual({
      title: 'Foto de perfil eliminada',
      message: 'Se restauró la visualización por defecto.',
    });
  });
});
