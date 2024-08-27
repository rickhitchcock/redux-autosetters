import { configureStore, createAction, createReducer } from '@reduxjs/toolkit';

export const set = {};
export const get = {};

export const createStore = (initialState, { afterChange = {}, reducers = {} }) => {
  const funcs = {};
  const methods = {};
  const allkeys = {};

  const getAllkeys = (obj, parents = []) => {
    Object.keys(obj).forEach((key) => {
      const val = obj[key];
      const isArray = Array.isArray(val);
      const isObject = !isArray && val !== null && typeof val === 'object';
      const fullkey = parents.length ? `${parents.join('.')}.${key}` : key;

      allkeys[fullkey] = true;

      if (isObject) {
        getAllkeys(obj[key], [...parents, key]);
      }
    });
  }; // getAllkeys

  getAllkeys(initialState);

  const processMethods = ((state, key) => {
    if (methods[key]) {
      Object.keys(methods[key]).forEach((k) => {
        let st = state;
        k.split('.').slice(0, -1).forEach((key2) => {
          st = st[key2];
        });
        const l = k.includes('.') ? k.split('.').slice(-1)[0] : k;
        st[l] = methods[key][k](state);
        processMethods(state, k);
      });
    }
  });

  const builders = (builder) => {
    const recurse = (obj, set2, get2, parents = []) => {
      Object.keys(obj).forEach((key) => {
        const val = obj[key];
        const isArray = Array.isArray(val);
        const isObject = !isArray && val !== null && typeof val === 'object';
        const fullkey = parents.length ? `${parents.join('.')}.${key}` : key;
        allkeys[fullkey] = true;

        get2[key] = (state) => {
          const st = parents.reduce((acc, k) => acc[k], state);

          if (!st) {
            alert(`Unknown: ${fullkey}`);
          }
          return st[key];
        };

        if (typeof obj[key] === 'function') {
          funcs[fullkey] = obj[key];
          const func = obj[key].toString();

          Object.keys(allkeys).forEach((key2) => {
            const regex = new RegExp(`${key2?.replace(/[.$]/g, (c) => `\\${c}`)}`);
            if (func.match(regex)) {
              methods[key2] = methods[key2] || {};
              methods[key2][fullkey] = funcs[fullkey];
            }
          });

          obj[key] = funcs[fullkey](initialState);
        }

        set2[key] = createAction(fullkey);

        builder
          .addCase(set2[key], (state, action) => {
            const st = parents.reduce((acc, k) => acc[k], state);

            if (isArray && Number.isFinite(action.payload.index)) {
              const { index, value } = action.payload;
              st[key][index] = value;
            } else if (typeof action.payload === 'function') {
              st[key] = action.payload(st[key]);
            } else {
              st[key] = action.payload;
            }

            if (afterChange[fullkey]) {
              const ac = afterChange[fullkey](state, action);
              if (ac) {
                ac.forEach((parm) => afterChange[parm](state, action));
              }
            }

            // TODO:  Is the first of these needed?
            processMethods(state, key);
            processMethods(state, fullkey);

            if (afterChange[fullkey]) {
              const func = afterChange[fullkey].toString();
              Object.keys(allkeys).forEach((key2) => {
                if (func.match(new RegExp(`${key2?.replace(/[.$]/g, (c) => `\\${c}`)}`))) {
                  processMethods(state, key2);
                }
              });
            }
          });

        if (isObject) {
          recurse(obj[key], set2[key], get2[key], [...parents, key]);
        }
      });
    }; // recurse

    Object.entries(reducers).forEach(([key, reducer]) => {
      const action = createAction(key);
      builder.addCase(action, reducer);
    });

    builder.addCase(createAction('api'), (state, { payload }) => {
      const method = payload.options.method || 'get';
      fetch(payload.url, {
        method,
        headers: payload.options.headers,
        body: payload.options.body,
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {
          if (typeof payload.callback === 'function') {
            payload.callback(data);
          } else {
            alert(`Error: ${JSON.stringify(payload, null, 2)}`);
          }
        })
        .catch((error) => {
          console.log('api error: ', payload.options.method);
          console.log(payload);
          console.log(error);
          console.log('_'.repeat(40));
          if (typeof payload.error === 'function') {
            payload.error(error);
          }
        });
    });

    recurse(initialState, set, get);

    builder.addDefaultCase((state, action) => {
      if (action.type !== '@@INIT') {
        console.log(`Unknown action: ${JSON.stringify(action)}`);
      }
    });
  }; // builders

  const reducer = createReducer(initialState, builders);

  return configureStore({
    reducer,
    middleware: (getDefaultMiddleware) => getDefaultMiddleware({
      serializableCheck: false,
    }),
  });
}; // createStore
