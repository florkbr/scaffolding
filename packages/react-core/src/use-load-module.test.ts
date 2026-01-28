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

  const mockModuleDefinition = {
    scope: 'testScope',
    module: 'testModule',
  };
  const mockManifestLocation = 'http://example.com/manifest.json';

  let mockPluginStore: { getExposedModule: jest.Mock };
  let mockDefaultExport: { component: string };
  let mockNamedExport: { component: string };
  let mockModuleWithExports: {
    default: { component: string };
    namedExport?: { component: string };
    customExport?: { component: string };
    otherExport?: { component: string };
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default exports
    mockDefaultExport = { component: 'DefaultComponent' };
    mockNamedExport = { component: 'NamedComponent' };
    mockModuleWithExports = {
      default: mockDefaultExport,
      namedExport: mockNamedExport,
    };

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

    // Default behavior: module not cached, successful manifest processing
    mockGetCachedModule.mockReturnValue({ cachedModule: undefined });
    mockProcessManifest.mockResolvedValue(undefined);
    mockPluginStore.getExposedModule.mockResolvedValue(mockModuleWithExports);
  });

  describe('when importName is provided', () => {
    it('should load the specified named export from a module', async () => {
      const { result } = renderHook(() =>
        useLoadModule(
          {
            ...mockModuleDefinition,
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
      expect(mockPluginStore.getExposedModule).toHaveBeenCalledWith(mockModuleDefinition.scope, mockModuleDefinition.module);
    });

    it('should load the specified named export when module is cached', async () => {
      const customExport = { component: 'CachedNamedComponent' };
      mockModuleWithExports.customExport = customExport;

      mockGetCachedModule.mockReturnValue({ cachedModule: mockModuleWithExports });

      const { result } = renderHook(() =>
        useLoadModule(
          {
            ...mockModuleDefinition,
            module: 'cachedModule',
            importName: 'customExport',
          },
          undefined,
        ),
      );

      await waitFor(() => {
        expect(result.current[0]).toEqual(customExport);
      });

      expect(result.current[0]).toEqual(customExport);
      expect(result.current[1]).toBeUndefined();
      expect(mockProcessManifest).not.toHaveBeenCalled();
    });
  });

  describe('when importName is omitted', () => {
    it('should load the default export from a module', async () => {
      const { result } = renderHook(() => useLoadModule(mockModuleDefinition, undefined));

      // Initially, data should be undefined
      expect(result.current[0]).toBeUndefined();
      expect(result.current[1]).toBeUndefined();

      // Wait for the module to load
      await waitFor(() => {
        expect(result.current[0]).toEqual(mockDefaultExport);
      });

      expect(result.current[0]).toEqual(mockDefaultExport);
      expect(result.current[1]).toBeUndefined();
      expect(mockPluginStore.getExposedModule).toHaveBeenCalledWith(mockModuleDefinition.scope, mockModuleDefinition.module);
    });

    it('should load the default export when module is cached', async () => {
      mockGetCachedModule.mockReturnValue({ cachedModule: mockModuleWithExports });

      const { result } = renderHook(() =>
        useLoadModule(
          {
            ...mockModuleDefinition,
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
      mockProcessManifest.mockRejectedValue(mockError);

      const { result } = renderHook(() => useLoadModule(mockModuleDefinition, undefined));

      await waitFor(() => {
        expect(result.current[1]).toEqual(mockError);
      });

      expect(result.current[0]).toBeUndefined();
      expect(result.current[1]).toEqual(mockError);
    });

    it('should set error state when getExposedModule fails', async () => {
      const mockError = new Error('Failed to get exposed module');
      mockPluginStore.getExposedModule.mockRejectedValue(mockError);

      const { result } = renderHook(() => useLoadModule(mockModuleDefinition, undefined));

      await waitFor(() => {
        expect(result.current[1]).toEqual(mockError);
      });

      expect(result.current[0]).toBeUndefined();
      expect(result.current[1]).toEqual(mockError);
    });
  });

  describe('with processor', () => {
    it('should pass processor to processManifest when provided', async () => {
      const mockProcessor = jest.fn(() => ['processed']);

      const { result } = renderHook(() =>
        useLoadModule(
          {
            ...mockModuleDefinition,
            processor: mockProcessor,
          },
          undefined,
        ),
      );

      await waitFor(() => {
        expect(result.current[0]).toEqual(mockDefaultExport);
      });

      expect(mockProcessManifest).toHaveBeenCalledWith(mockManifestLocation, mockModuleDefinition.scope, mockModuleDefinition.module, mockProcessor);
    });
  });

  describe('with defaultState', () => {
    it('should use defaultState as initial value', () => {
      const defaultState = { component: 'InitialComponent' };

      const { result } = renderHook(() => useLoadModule(mockModuleDefinition, defaultState));

      expect(result.current[0]).toEqual(defaultState);
    });
  });

  describe('cleanup', () => {
    it('should not update state after unmount', async () => {
      let resolveGetExposedModule: (value: unknown) => void;
      const getExposedModulePromise = new Promise((resolve) => {
        resolveGetExposedModule = resolve;
      });

      mockPluginStore.getExposedModule.mockReturnValue(getExposedModulePromise);

      const { result, unmount } = renderHook(() => useLoadModule(mockModuleDefinition, undefined));

      // Unmount before the promise resolves
      unmount();

      // Resolve the promise after unmount
      resolveGetExposedModule!(mockModuleWithExports);

      // Wait a bit to ensure any state updates would have occurred
      await new Promise((resolve) => setTimeout(resolve, 100));

      // State should still be undefined because component was unmounted
      expect(result.current[0]).toBeUndefined();
    });
  });
});
