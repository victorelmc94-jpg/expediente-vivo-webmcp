import {createHash} from 'node:crypto';

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function stableId(prefix, ...parts) {
  return `${prefix}_${sha256(parts.join('\u001f')).slice(0, 16)}`;
}

