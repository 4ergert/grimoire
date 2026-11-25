import { DE_ACCOUNT } from './de/account';
import { DE_ANALYSIS } from './de/analysis';
import { DE_COMMON } from './de/common';
import { DE_LIBRARY } from './de/library';
import { DE_PLAYGROUND } from './de/play-ground';

// German translations, keyed by the English source text.
export const DE: Record<string, string> = {
  ...DE_COMMON,
  ...DE_ACCOUNT,
  ...DE_LIBRARY,
  ...DE_PLAYGROUND,
  ...DE_ANALYSIS,
};
