import 'reflect-metadata';
import { getCache, setCache } from '@swma/shared';

export function Cache(keyPattern: string, ttl: number) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    // 1) building the key
    descriptor.value = async function (...args: any[]) {
      const key = keyPattern.replace(/{(\w+)}/g, (_, paramName) => {
        const paramIndex = getParamIndex(target, propertyKey, paramName);
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

function getParamIndex(
  target: any,
  methodName: string,
  paramName: string,
): number {
  const paramNames = getFunctionParamNames(target[methodName]);

  const index = paramNames.indexOf(paramName);

  if (index === -1) {
    throw new Error(`Param "${paramName}" not found in function ${methodName}`);
  }

  return index;
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
