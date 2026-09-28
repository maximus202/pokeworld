## User Stories

As a user, I want to be able to:

### Browse and discover

- [ ] View a list of all Pokemon so I can see what's available
    - [ ] The list loads in pages, with a "Load more" control that shows how many are left
    - [ ] If the list fails to load, I see an error with a way to try again
- [ ] Search for Pokemon by name so I can find a specific Pokemon
    - [ ] Matching is a case-insensitive substring match, and results update as I type
    - [ ] If nothing matches, I see a "no matches" message, and clearing the search restores the list
- [ ] Filter the list by type so I can discover Pokemon I didn't know to search for
    - [ ] Filtering by type works together with search
- [ ] Show only the Pokemon I've caught while browsing, so I can search and filter within my collection
    - [ ] A "Caught only" toggle works together with search and the type filter
- [ ] See at a glance which Pokemon in the list I've already caught

### Details

- [ ] View a Pokemon's details so I can learn more about it
    - [ ] Required: Name, Height, Abilities, Image
    - [ ] Also shown: Types and its Pokedex number
    - [ ] Open the details in a side panel, so closing it returns me to the screen I came from
    - [ ] A details link can be shared or reloaded and opens the same panel
    - [ ] If the details can't be loaded, the panel shows an error with a way to try again
- [ ] If a Pokemon is a Grass type, see it in its shiny form
    - [ ] "Grass type" means grass in any type slot, not just the primary type
    - [ ] The shiny image appears everywhere the Pokemon is shown: list, search results,
      collection and details panel
    - [ ] A "Shiny" badge marks shiny images so the colour change reads as intentional
    - [ ] If the shiny image is missing or fails to load, the default image is shown instead
      (without the badge)

### Collection

- [ ] Save (catch) a Pokemon to my collection so I can keep track of what I've caught
    - [ ] Catching a Pokemon that is already caught changes nothing, and keeps its original date
    - [ ] Only real Pokemon can be caught; an unknown name is rejected
- [ ] See when each Pokemon in my collection was caught
    - [ ] Every collection card shows the date it was caught
    - [ ] The details panel shows the caught date for a Pokemon I've caught
    - [ ] The collection is ordered by when I caught them, most recent first
    - [ ] Dates are shown in my local time zone
- [ ] View my collection of Pokemon so I can see what I've caught
    - [ ] The collection count in the navigation is correct as soon as the page loads, with no
      flash of a wrong number
    - [ ] While the collection loads I see a placeholder, and if it is empty I see a prompt to
      browse Pokemon
    - [ ] If a Pokemon in my collection can't be loaded, I see an error for it with a retry,
      instead of it silently disappearing
- [ ] Remove a Pokemon from my collection so I can undo a catch
    - [ ] I can remove it from the details panel
    - [ ] I can remove it directly from the collection grid, without opening the panel
- [ ] Reset my collection so I can start over
    - [ ] Empties every Pokemon from my collection in one action
    - [ ] I have to confirm first, and cancelling changes nothing
    - [ ] If the reset fails, I see an error and my collection is unchanged

### Private collection, no signup

- [ ] Have my own private collection without signing up or logging in so I can use the app right away
    - [ ] My collection is tied to my browser, so other visitors never see or change what I've caught
    - [ ] My collection is still there after I reload the page or restart my browser
    - [ ] See a short visitor label (e.g. "Trainer #a3f9") so I can tell which collection is mine

## Non-functional requirements

Not user-facing stories, but each should be visible in the submission:

- [ ] The app runs with `npm install` and `npm run dev`, with no other setup
- [ ] The app is usable on a phone-width screen and by keyboard
- [ ] PokeAPI failures show a clear error message and don't crash the app
- [ ] A single visitor's collection has a size cap, so the database can't grow without bound
- [ ] Automated tests cover every story above without calling the live PokeAPI
- [ ] The README explains the key decisions and tradeoffs, and what I'd do next

## Out of scope

Real authentication or accounts, sharing a collection with other users, trading or battling,
and evolution chains, moves or stats beyond the fields listed above.
