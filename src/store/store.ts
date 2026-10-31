/**
 * 상태를 한 곳에 모으는 저장소 (발행·구독).
 * setState로 바꾸면 구독자 전원에게 알린다. 화면은 구독만 한다.
 */
export type Listener<S> = (state: S) => void;

export type Store<S> = {
  get(): S;
  setState(patch: Partial<S>): void;
  subscribe(listener: Listener<S>): () => void;
};

export function createStore<S extends object>(initial: S): Store<S> {
  let state = initial;
  const listeners = new Set<Listener<S>>();
  return {
    get: () => state,
    setState(patch) {
      state = { ...state, ...patch };
      listeners.forEach((fn) => fn(state));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
