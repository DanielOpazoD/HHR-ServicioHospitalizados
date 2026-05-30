import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createUserAvatarProfileService } from '@/services/user-profile/userAvatarProfileService';

const repository = {
  getDoc: vi.fn(),
  setDoc: vi.fn(),
};

const storageRef = { fullPath: 'user-avatars/user-1/avatar' };
const storageRuntime = {
  getStorage: vi.fn(),
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
  deleteObject: vi.fn(),
};

const createImageFile = (size = 128) =>
  new File([new Uint8Array(size)], 'foto perfil.png', { type: 'image/png' });

describe('userAvatarProfileService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repository.getDoc.mockResolvedValue(null);
    storageRuntime.getStorage.mockResolvedValue({ bucket: 'test' });
    storageRuntime.ref.mockReturnValue(storageRef);
    storageRuntime.uploadBytes.mockResolvedValue(undefined);
    storageRuntime.getDownloadURL.mockResolvedValue(
      'https://storage.test/user-avatars/user-1/avatar?token=abc'
    );
    storageRuntime.deleteObject.mockResolvedValue(undefined);
  });

  it('uploads an avatar to a stable user-owned path and stores profile metadata in user settings', async () => {
    const service = createUserAvatarProfileService({
      repository,
      storageRuntime,
      now: () => '2026-05-30T12:00:00.000Z',
    });

    const profile = await service.uploadAvatar({
      uid: ' user-1 ',
      email: 'doctor@hospital.cl',
      file: createImageFile(),
    });

    expect(storageRuntime.ref).toHaveBeenCalledWith(
      { bucket: 'test' },
      'user-avatars/user-1/avatar'
    );
    expect(storageRuntime.uploadBytes).toHaveBeenCalledWith(storageRef, expect.any(File), {
      contentType: 'image/png',
      customMetadata: {
        module: 'user-profile',
        userId: 'user-1',
      },
    });
    expect(repository.setDoc).toHaveBeenCalledWith(
      'userSettings',
      'user-1',
      {
        userAvatarProfile: {
          uid: 'user-1',
          email: 'doctor@hospital.cl',
          photoURL:
            'https://storage.test/user-avatars/user-1/avatar?token=abc&v=2026-05-30T12%3A00%3A00.000Z',
          storagePath: 'user-avatars/user-1/avatar',
          updatedAt: '2026-05-30T12:00:00.000Z',
        },
      },
      { merge: true }
    );
    expect(profile.photoURL).toContain('v=2026-05-30T12%3A00%3A00.000Z');
  });

  it('rejects non-image avatar files before touching storage', async () => {
    const service = createUserAvatarProfileService({ repository, storageRuntime });
    const file = new File(['text'], 'avatar.txt', { type: 'text/plain' });

    await expect(
      service.uploadAvatar({ uid: 'user-1', email: 'doctor@hospital.cl', file })
    ).rejects.toThrow('Solo se permiten imágenes');

    expect(storageRuntime.uploadBytes).not.toHaveBeenCalled();
    expect(repository.setDoc).not.toHaveBeenCalled();
  });

  it('removes the stored avatar and clears the profile metadata for the same user', async () => {
    repository.getDoc.mockResolvedValueOnce({
      userAvatarProfile: {
        uid: 'user-1',
        email: 'doctor@hospital.cl',
        photoURL: 'https://storage.test/avatar',
        storagePath: 'user-avatars/user-1/avatar',
        updatedAt: '2026-05-29T12:00:00.000Z',
      },
    });
    const service = createUserAvatarProfileService({ repository, storageRuntime });

    await service.removeAvatar(' user-1 ');

    expect(storageRuntime.ref).toHaveBeenCalledWith(
      { bucket: 'test' },
      'user-avatars/user-1/avatar'
    );
    expect(storageRuntime.deleteObject).toHaveBeenCalledWith(storageRef);
    expect(repository.setDoc).toHaveBeenCalledWith(
      'userSettings',
      'user-1',
      { userAvatarProfile: null },
      { merge: true }
    );
  });
});
