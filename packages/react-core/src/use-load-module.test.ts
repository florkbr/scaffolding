import { renderHook, waitFor } from '@testing-library/react';
import { useLoadModule } from './use-load-module';
import { getCachedModule, getAppData, processManifest, getScalprum } from '@scalprum/core';

// Mock @scalprum/core functions
jest.mock('@scalprum/core', () => ({
  getCachedModule: jest.fn(),
  getAppData: jest.fn(),
  processManifest: jest.fn(),
  getScalprum: jest.fn(),
}));

describe('useLoadModule', () => {
  const mockGetCachedModule = getCachedModule as jest.Mock;
  const mockGetAppData = getAppData as jest.Mock;
  const mockProcessManifest = processManifest as jest.Mock;
  const mockGetScalprum = getScalprum as jest.Mock;

  const mockScope = 'testScope';
  const mockModule = 'testModule';
  const mockManifestLocation = 'http://example.com/manifest.json';

  let mockPluginStore: { getExposedModule: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock for pluginStore
    mockPluginStore = {
      getExposedModule: jest.fn(),
    };

    mockGetScalprum.mockReturnValue({
      pluginStore: mockPluginStore,
    });

    mockGetAppData.mockReturnValue({
      manifestLocation: mockManifestLocation,
    });
  });

  describe('when importName is provided', () => {
    it('should load the specified named export from a module', async () => {
      const mockNamedExport = { component: 'NamedComponent' };
      const mockModule = {
        default: { component: 'DefaultComponent' },
        namedExport: mockNamedExport,
      };

      mockGetCachedModule.mockReturnValue({ cachedModule: undefined });
      mockProcessManifest.mockResolvedValue(undefined);
      mockPluginStore.getExposedModule.mockResolvedValue(mockModule);

      const { result } = renderHook(() =>
        useLoadModule(
          {
            scope: mockScope,
            module: 'testModule',
            importName: 'namedExport',
          },
          undefined,
        ),
      );

      // Initially, data should be undefined
      expect(result.current[0]).toBeUndefined();
      expect(result.current[1]).toBeUndefined();

      // Wait for the module to load
      await waitFor(() => {
        expect(result.current[0]).toEqual(mockNamedExport);
      });

      expect(result.current[0]).toEqual(mockNamedExport);
      expect(result.current[1]).toBeUndefined();
      expect(mockPluginStore.getExposedModule).toHaveBeenCalledWith(mockScope, 'testModule');
    });

    it('should load the specified named export when module is cached', async () => {
      const mockNamedExport = { component: 'CachedNamedComponent' };
      const mockModule = {
        default: { component: 'DefaultComponent' },
        customExport: mockNamedExport,
      };

      mockGetCachedModule.mockReturnValue({ cachedModule: mockModule });
      mockPluginStore.getExposedModule.mockResolvedValue(mockModule);

      const { result } = renderHook(() =>
        useLoadModule(
          {
            scope: mockScope,
            module: 'cachedModule',
            importName: 'customExport',
          },
          undefined,
        ),
      );

      await waitFor(() => {
        expect(result.current[0]).toEqual(mockNamedExport);
      });

      expect(result.current[0]).toEqual(mockNamedExport);
      expect(result.current[1]).toBeUndefined();
      expect(mockProcessManifest).not.toHaveBeenCalled();
    });
  });

  describe('when importName is omitted', () => {
    it('should load the default export from a module', async () => {
      const mockDefaultExport = { component: 'DefaultComponent' };
      const mockModule = {
        default: mockDefaultExport,
        namedExport: { component: 'NamedComponent' },
      };

      mockGetCachedModule.mockReturnValue({ cachedModule: undefined });
      mockProcessManifest.mockResolvedValue(undefined);
      mockPluginStore.getExposedModule.mockResolvedValue(mockModule);

      const { result } = renderHook(() =>
        useLoadModule(
          {
            scope: mockScope,
            module: 'testModule',
          },
          undefined,
        ),
      );

      // Initially, data should be undefined
      expect(result.current[0]).toBeUndefined();
      expect(result.current[1]).toBeUndefined();

      // Wait for the module to load
      await waitFor(() => {
        expect(result.current[0]).toEqual(mockDefaultExport);
      });

      expect(result.current[0]).toEqual(mockDefaultExport);
      expect(result.current[1]).toBeUndefined();
      expect(mockPluginStore.getExposedModule).toHaveBeenCalledWith(mockScope, 'testModule');
    });

    it('should load the default export when module is cached', async () => {
      const mockDefaultExport = { component: 'CachedDefaultComponent' };
      const mockModule = {
        default: mockDefaultExport,
        otherExport: { component: 'OtherComponent' },
      };

      mockGetCachedModule.mockReturnValue({ cachedModule: mockModule });
      mockPluginStore.getExposedModule.mockResolvedValue(mockModule);

      const { result } = renderHook(() =>
        useLoadModule(
          {
            scope: mockScope,
            module: 'cachedModule',
          },
          undefined,
        ),
      );

      await waitFor(() => {
        expect(result.current[0]).toEqual(mockDefaultExport);
      });

      expect(result.current[0]).toEqual(mockDefaultExport);
      expect(result.current[1]).toBeUndefined();
      expect(mockProcessManifest).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should set error state when processManifest fails', async () => {
      const mockError = new Error('Failed to process manifest');
      mockGetCachedModule.mockReturnValue({ cachedModule: undefined });
      mockProcessManifest.mockRejectedValue(mockError);

      const { result } = renderHook(() =>
        useLoadModule(
          {
            scope: mockScope,
            module: 'testModule',
          },
          undefined,
        ),
      );

      await waitFor(() => {
        expect(result.current[1]).toEqual(mockError);
      });

      expect(result.current[0]).toBeUndefined();
      expect(result.current[1]).toEqual(mockError);
    });

    it('should set error state when getExposedModule fails', async () => {
      const mockError = new Error('Failed to get exposed module');
      mockGetCachedModule.mockReturnValue({ cachedModule: undefined });
      mockProcessManifest.mockResolvedValue(undefined);
      mockPluginStore.getExposedModule.mockRejectedValue(mockError);

      const { result } = renderHook(() =>
        useLoadModule(
          {
            scope: mockScope,
            module: 'testModule',
          },
          undefined,
        ),
      );

      await waitFor(() => {
        expect(result.current[1]).toEqual(mockError);
      });

      expect(result.current[0]).toBeUndefined();
      expect(result.current[1]).toEqual(mockError);
    });
  });

  describe('with processor', () => {
    it('should pass processor to processManifest when provided', async () => {
      const mockProcessor = jest.fn((item: any) => ['processed']);
      const mockDefaultExport = { component: 'ProcessedComponent' };
      const mockModule = {
        default: mockDefaultExport,
      };

      mockGetCachedModule.mockReturnValue({ cachedModule: undefined });
      mockProcessManifest.mockResolvedValue(undefined);
      mockPluginStore.getExposedModule.mockResolvedValue(mockModule);

      const { result } = renderHook(() =>
        useLoadModule(
          {
            scope: mockScope,
            module: 'testModule',
            processor: mockProcessor,
          },
          undefined,
        ),
      );

      await waitFor(() => {
        expect(result.current[0]).toEqual(mockDefaultExport);
      });

      expect(mockProcessManifest).toHaveBeenCalledWith(mockManifestLocation, mockScope, 'testModule', mockProcessor);
    });
  });

  describe('with defaultState', () => {
    it('should use defaultState as initial value', () => {
      const defaultState = { component: 'InitialComponent' };
      mockGetCachedModule.mockReturnValue({ cachedModule: undefined });

      const { result } = renderHook(() =>
        useLoadModule(
          {
            scope: mockScope,
            module: 'testModule',
          },
          defaultState,
        ),
      );

      expect(result.current[0]).toEqual(defaultState);
    });
  });

  describe('cleanup', () => {
    it('should not update state after unmount', async () => {
      const mockDefaultExport = { component: 'DefaultComponent' };
      const mockModule = {
        default: mockDefaultExport,
      };

      let resolveGetExposedModule: (value: any) => void;
      const getExposedModulePromise = new Promise((resolve) => {
        resolveGetExposedModule = resolve;
      });

      mockGetCachedModule.mockReturnValue({ cachedModule: undefined });
      mockProcessManifest.mockResolvedValue(undefined);
      mockPluginStore.getExposedModule.mockReturnValue(getExposedModulePromise);

      const { result, unmount } = renderHook(() =>
        useLoadModule(
          {
            scope: mockScope,
            module: 'testModule',
          },
          undefined,
        ),
      );

      // Unmount before the promise resolves
      unmount();

      // Resolve the promise after unmount
      resolveGetExposedModule!(mockModule);

      // Wait a bit to ensure any state updates would have occurred
      await new Promise((resolve) => setTimeout(resolve, 100));

      // State should still be undefined because component was unmounted
      expect(result.current[0]).toBeUndefined();
    });
  });
});
