import 'reflect-metadata';
import { getCache, setCache } from './redis';

export function Cache(keyPattern: string, ttl: number) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    const paramNames = getFunctionParamNames(originalMethod);
    // 1) building the key
    descriptor.value = async function (...args: any[]) {
      const key = keyPattern.replace(/{(\w+)}/g, (_, paramName) => {
        const paramIndex = paramNames.indexOf(paramName);
        if (paramIndex === -1) {
          throw new Error(
            `Param "${paramName}" not found in function ${propertyKey}`,
          );
        }
        return args[paramIndex];
      });

      // 2) checking cache
      const cached = await getCache(key);
      if (cached) return cached;

      // 3) call original method
      const result = await originalMethod.apply(this, args);

      await setCache(key, result, ttl);

      return result;
    };

    return descriptor;
  };
}

// Get argument names from function source (simple version)
function getFunctionParamNames(fn: Function): string[] {
  const fnStr = fn.toString();
  const match = fnStr.match(/\(([^)]*)\)/);
  if (!match) return [];

  return match[1]
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
}
