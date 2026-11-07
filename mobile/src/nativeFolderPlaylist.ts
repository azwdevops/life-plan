import { NativeModules } from 'react-native';
import type { AudioTrack } from './types';

const { FolderPlaylistModule } = NativeModules;

export interface PlaylistTrack extends AudioTrack {
  lastModified: number; // epoch ms
}

export interface FolderContents {
  folderName: string;
  files: PlaylistTrack[];
}

export async function listAudioFiles(treeUri: string): Promise<FolderContents> {
  const result = await FolderPlaylistModule.listAudioFiles(treeUri);
  return {
    folderName: result.folderName,
    files: result.files.map((f: { uri: string; name: string; lastModified: number }) => ({
      uri: f.uri,
      fileName: f.name,
      lastModified: f.lastModified,
    })),
  };
}
