import { NativeModules } from 'react-native';
import type { AudioTrack } from './types';

const { FolderPlaylistModule } = NativeModules;

export interface FolderContents {
  folderName: string;
  files: AudioTrack[];
}

export async function listAudioFiles(treeUri: string): Promise<FolderContents> {
  const result = await FolderPlaylistModule.listAudioFiles(treeUri);
  return {
    folderName: result.folderName,
    files: result.files.map((f: { uri: string; name: string }) => ({ uri: f.uri, fileName: f.name })),
  };
}
