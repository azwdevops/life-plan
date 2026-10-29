import { AppRegistry } from 'react-native';
import TrackPlayer from 'react-native-track-player';
import App from './App';
import { name as appName } from './app.json';
import { PlaybackService } from './src/playbackService';
import headlessAudioTask from './src/headlessAudioTask';
import taskReminderTask from './src/taskReminderTask';

AppRegistry.registerComponent(appName, () => App);
TrackPlayer.registerPlaybackService(() => PlaybackService);
AppRegistry.registerHeadlessTask('AudioScheduleTrigger', () => headlessAudioTask);
AppRegistry.registerHeadlessTask('TaskReminderTrigger', () => taskReminderTask);
