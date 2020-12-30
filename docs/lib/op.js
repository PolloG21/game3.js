
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.wholeText !== data)
            text.data = data;
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    /* src\TailwindCss.svelte generated by Svelte v3.31.0 */

    function add_css() {
    	var style = element("style");
    	style.id = "svelte-1k5bkhw-style";
    	append(document.head, style);
    }

    class TailwindCss extends SvelteComponent {
    	constructor(options) {
    		super();
    		if (!document.getElementById("svelte-1k5bkhw-style")) add_css();
    		init(this, options, null, null, safe_not_equal, {});
    	}
    }

    const subscriber_queue = [];
    /**
     * Creates a `Readable` store that allows reading by subscription.
     * @param value initial value
     * @param {StartStopNotifier}start start and stop notifications for subscriptions
     */
    function readable(value, start) {
        return {
            subscribe: writable(value, start).subscribe
        };
    }
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = [];
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (let i = 0; i < subscribers.length; i += 1) {
                        const s = subscribers[i];
                        s[1]();
                        subscriber_queue.push(s, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.push(subscriber);
            if (subscribers.length === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                const index = subscribers.indexOf(subscriber);
                if (index !== -1) {
                    subscribers.splice(index, 1);
                }
                if (subscribers.length === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    const SDK_STATES = {
        NOT_CONNECTED: 1,
        CONNECTING: 2,
        CONNECTED: 3
    };

    function createApiKey() {
        const { subscribe, set, update } = writable("");
        
        return {
            subscribe,
            connect: () => {
                update(key =>
                    {
                        sdkState.connect(key);
                        return key;
                    }
                );
            },

            disconnect: () => {
                update(key =>
                    console.log(key + " disconnect")
                );
            },

            set
        }
    }

    function createSdkState() {
        const { subscribe } = readable(SDK_STATES.NOT_CONNECTED,
            set => {
                console.log(set);
            }

            );

        return {
            subscribe,
            connect: (key) => {
                console.log(key);
                set(key);
                return SDK_STATES.CONNECTING;
            }

        }
    }

    const apiKey = createApiKey();
    const sdkState = createSdkState();

    const url = readable(window.location.href);

    /* src\components\SdkModal.svelte generated by Svelte v3.31.0 */

    function create_if_block(ctx) {
    	let button;
    	let t0;
    	let t1;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			button = element("button");
    			t0 = text("Connect ");
    			t1 = text(/*$sdkState*/ ctx[2]);
    			attr(button, "class", "flex-shrink-0 bg-purple-600 text-white text-base font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-purple-200");
    		},
    		m(target, anchor) {
    			insert(target, button, anchor);
    			append(button, t0);
    			append(button, t1);

    			if (!mounted) {
    				dispose = listen(button, "click", apiKey.connect);
    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty & /*$sdkState*/ 4) set_data(t1, /*$sdkState*/ ctx[2]);
    		},
    		d(detaching) {
    			if (detaching) detach(button);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function create_fragment(ctx) {
    	let div7;
    	let div0;
    	let t0;
    	let div6;
    	let div1;
    	let t3;
    	let div5;
    	let div3;
    	let t6;
    	let p1;
    	let t7;
    	let t8;
    	let div4;
    	let input;
    	let t9;
    	let t10;
    	let p2;
    	let t12;
    	let p3;
    	let t14;
    	let p4;
    	let mounted;
    	let dispose;
    	let if_block = /*$sdkState*/ ctx[2] == SDK_STATES.NOT_CONNECTED && create_if_block(ctx);

    	return {
    		c() {
    			div7 = element("div");
    			div0 = element("div");
    			t0 = space();
    			div6 = element("div");
    			div1 = element("div");

    			div1.innerHTML = `<svg class="fill-current text-white" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><path d="M14.53 4.53l-1.06-1.06L9 7.94 4.53 3.47 3.47 4.53 7.94 9l-4.47 4.47 1.06 1.06L9 10.06l4.47 4.47 1.06-1.06L10.06 9z"></path></svg> 
        <span class="text-sm">(Esc)</span>`;

    			t3 = space();
    			div5 = element("div");
    			div3 = element("div");

    			div3.innerHTML = `<p class="text-2xl font-bold">OP Arcade Console 🖥</p> 
          <div class="modal-close cursor-pointer z-50"><svg class="fill-current text-black" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><path d="M14.53 4.53l-1.06-1.06L9 7.94 4.53 3.47 3.47 4.53 7.94 9l-4.47 4.47 1.06 1.06L9 10.06l4.47 4.47 1.06-1.06L10.06 9z"></path></svg></div>`;

    			t6 = space();
    			p1 = element("p");
    			t7 = text(/*$url*/ ctx[0]);
    			t8 = space();
    			div4 = element("div");
    			input = element("input");
    			t9 = space();
    			if (if_block) if_block.c();
    			t10 = space();
    			p2 = element("p");
    			p2.textContent = "...";
    			t12 = space();
    			p3 = element("p");
    			p3.textContent = "...";
    			t14 = space();
    			p4 = element("p");
    			p4.textContent = "...";
    			attr(div0, "class", "modal-overlay absolute w-full h-full bg-gray-900 opacity-50");
    			attr(div1, "class", "modal-close absolute top-0 right-0 cursor-pointer flex flex-col items-center mt-4 mr-4 text-white text-sm z-50");
    			attr(div3, "class", "flex justify-between items-center pb-3");
    			attr(input, "class", "mr-2 py-2 px-4 bg-white text-gray-700 placeholder-gray-500 shadow-md rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent");
    			attr(input, "placeholder", "API key");
    			attr(div4, "class", "flex pt-2");
    			attr(div5, "class", "modal-content py-4 text-left px-6");
    			attr(div6, "class", "modal-container bg-white w-11/12 md:max-w-md mx-auto rounded shadow-lg z-50 overflow-y-auto");
    			attr(div7, "class", "modal opacity-0 pointer-events-none fixed w-full h-full top-0 left-0 flex items-center justify-center");
    		},
    		m(target, anchor) {
    			insert(target, div7, anchor);
    			append(div7, div0);
    			append(div7, t0);
    			append(div7, div6);
    			append(div6, div1);
    			append(div6, t3);
    			append(div6, div5);
    			append(div5, div3);
    			append(div5, t6);
    			append(div5, p1);
    			append(p1, t7);
    			append(div5, t8);
    			append(div5, div4);
    			append(div4, input);
    			set_input_value(input, /*$apiKey*/ ctx[1]);
    			append(div4, t9);
    			if (if_block) if_block.m(div4, null);
    			append(div5, t10);
    			append(div5, p2);
    			append(div5, t12);
    			append(div5, p3);
    			append(div5, t14);
    			append(div5, p4);

    			if (!mounted) {
    				dispose = listen(input, "input", /*input_input_handler*/ ctx[3]);
    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*$url*/ 1) set_data(t7, /*$url*/ ctx[0]);

    			if (dirty & /*$apiKey*/ 2 && input.value !== /*$apiKey*/ ctx[1]) {
    				set_input_value(input, /*$apiKey*/ ctx[1]);
    			}

    			if (/*$sdkState*/ ctx[2] == SDK_STATES.NOT_CONNECTED) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(div4, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div7);
    			if (if_block) if_block.d();
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let $url;
    	let $apiKey;
    	let $sdkState;
    	component_subscribe($$self, url, $$value => $$invalidate(0, $url = $$value));
    	component_subscribe($$self, apiKey, $$value => $$invalidate(1, $apiKey = $$value));
    	component_subscribe($$self, sdkState, $$value => $$invalidate(2, $sdkState = $$value));

    	function input_input_handler() {
    		$apiKey = this.value;
    		apiKey.set($apiKey);
    	}

    	return [$url, $apiKey, $sdkState, input_input_handler];
    }

    class SdkModal extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment, safe_not_equal, {});
    	}
    }

    var img = "data:image/png;base64,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";

    /* src\Op.svelte generated by Svelte v3.31.0 */

    function create_fragment$1(ctx) {
    	let tailwindcss;
    	let t0;
    	let main;
    	let button;
    	let img$1;
    	let img_src_value;
    	let t1;
    	let sdkmodal;
    	let current;
    	tailwindcss = new TailwindCss({});
    	sdkmodal = new SdkModal({});

    	return {
    		c() {
    			create_component(tailwindcss.$$.fragment);
    			t0 = space();
    			main = element("main");
    			button = element("button");
    			img$1 = element("img");
    			t1 = space();
    			create_component(sdkmodal.$$.fragment);
    			attr(img$1, "class", "w-10 h-10 fill-current");
    			attr(img$1, "alt", "g3js logo");
    			if (img$1.src !== (img_src_value = img)) attr(img$1, "src", img_src_value);
    			attr(button, "class", "modal-open m-2 fixed bottom-0 left-0 inline-flex items-center justify-center w-12 h-12 mr-2 transition-colors duration-300 bg-indigo-700 rounded-full hover:bg-indigo-900");
    		},
    		m(target, anchor) {
    			mount_component(tailwindcss, target, anchor);
    			insert(target, t0, anchor);
    			insert(target, main, anchor);
    			append(main, button);
    			append(button, img$1);
    			append(main, t1);
    			mount_component(sdkmodal, main, null);
    			current = true;
    		},
    		p: noop,
    		i(local) {
    			if (current) return;
    			transition_in(tailwindcss.$$.fragment, local);
    			transition_in(sdkmodal.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(tailwindcss.$$.fragment, local);
    			transition_out(sdkmodal.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(tailwindcss, detaching);
    			if (detaching) detach(t0);
    			if (detaching) detach(main);
    			destroy_component(sdkmodal);
    		}
    	};
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let $url;
    	component_subscribe($$self, url, $$value => $$invalidate(1, $url = $$value));

    	function props() {
    		return { url: $url };
    	}

    	onMount(async () => {
    		var openmodal = document.querySelectorAll(".modal-open");

    		for (var i = 0; i < openmodal.length; i++) {
    			openmodal[i].addEventListener("click", function (event) {
    				event.preventDefault();
    				toggleModal();
    			});
    		}

    		const overlay = document.querySelector(".modal-overlay");
    		overlay.addEventListener("click", toggleModal);
    		var closemodal = document.querySelectorAll(".modal-close");

    		for (var i = 0; i < closemodal.length; i++) {
    			closemodal[i].addEventListener("click", toggleModal);
    		}

    		document.onkeydown = function (evt) {
    			evt = evt || window.event;
    			var isEscape = false;

    			if ("key" in evt) {
    				isEscape = evt.key === "Escape" || evt.key === "Esc";
    			} else {
    				isEscape = evt.keyCode === 27;
    			}

    			if (isEscape && document.body.classList.contains("modal-active")) {
    				toggleModal();
    			}
    		};

    		function toggleModal() {
    			const body = document.querySelector("body");
    			const modal = document.querySelector(".modal");
    			modal.classList.toggle("opacity-0");
    			modal.classList.toggle("pointer-events-none");
    			body.classList.toggle("modal-active");
    		}
    	});

    	return [props];
    }

    class Op extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { props: 0 });
    	}

    	get props() {
    		return this.$$.ctx[0];
    	}
    }

    const op = new Op({
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    // attach to window
    window.op = op;

    return op;

}());
//# sourceMappingURL=op.js.map