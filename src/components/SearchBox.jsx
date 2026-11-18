'use client';

import {useEffect, useState} from 'react';
import {useRouter} from 'next/navigation';
import {ROUTES} from '@/lib/routes';

const DEBOUNCE_MS = 150;
const LIST_ID = 'search-suggestions';
const optionId = (index) => `search-suggestion-${index}`;

// The header search form. Typing shows matching listing titles; picking one opens that listing,
// and submitting the form still goes to the full results page.
export default function SearchBox() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) {
      setSuggestions([]);
      return undefined;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search/suggest?q=${encodeURIComponent(text)}`, {signal: controller.signal});
        const data = response.ok ? await response.json() : {suggestions: []};
        setSuggestions(data.suggestions);
        setActive(-1);
      } catch (error) {
        // Suggestions are optional: if they fail, the plain search form still works.
        if (error.name !== 'AbortError') setSuggestions([]);
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const expanded = open && suggestions.length > 0;

  const close = () => {
    setOpen(false);
    setActive(-1);
  };

  const choose = (suggestion) => {
    close();
    setQuery('');
    router.push(ROUTES.listing(suggestion._id));
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape' && expanded) {
      event.preventDefault();
      close();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!suggestions.length) return;
      event.preventDefault();
      setOpen(true);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      // -1 is the text box itself, so the user can arrow back to what they typed.
      setActive((current) => ((current + step + 1 + suggestions.length + 1) % (suggestions.length + 1)) - 1);
    } else if (event.key === 'Enter' && expanded && active >= 0) {
      event.preventDefault();
      choose(suggestions[active]);
    }
  };

  return (
    <form className='header-search' role='search' action={ROUTES.search} method='get'>
      <label htmlFor='site-search' className='sr-only'>
        Search listings
      </label>
      <input
        id='site-search'
        type='search'
        name='q'
        placeholder='Search listings'
        autoComplete='off'
        role='combobox'
        aria-autocomplete='list'
        aria-controls={LIST_ID}
        aria-expanded={expanded}
        aria-activedescendant={expanded && active >= 0 ? optionId(active) : undefined}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => setOpen(true)}
        onBlur={close}
      />
      <button type='submit'>Search</button>
      <ul id={LIST_ID} className='search-suggestions' role='listbox' aria-label='Suggested listings' hidden={!expanded}>
        {suggestions.map((suggestion, index) => (
          <li
            key={suggestion._id}
            id={optionId(index)}
            role='option'
            aria-selected={index === active}
            // Keeps focus in the text box, so the blur above doesn't close the list mid-click.
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => choose(suggestion)}
          >
            {suggestion.title}
          </li>
        ))}
      </ul>
    </form>
  );
}
