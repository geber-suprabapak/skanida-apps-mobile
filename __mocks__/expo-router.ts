export const mockRouter = {
  back: jest.fn(),
  canGoBack: jest.fn(() => false),
  push: jest.fn(),
  replace: jest.fn(),
  navigate: jest.fn(),
};

export function useRouter() {
  return mockRouter;
}

export function useLocalSearchParams() {
  return {};
}

export function useFocusEffect(callback: () => void) {
  callback();
}

export function Stack() {
  return null;
}

export namespace Stack {
  export function Screen() {
    return null;
  }
}

type TabsProps = {
  children?: unknown;
  screenOptions?: unknown;
};

export function Tabs(_props: TabsProps) {
  return null;
}

export namespace Tabs {
  export function Screen(_props: { name: string }) {
    return null;
  }
}
