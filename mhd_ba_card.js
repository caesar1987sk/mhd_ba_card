class MhdBaCard extends HTMLElement {
	_cardBuilt;
	_cardBuiltResolve;
	_itemCount = 0;

	// Return the card editor for configuration in the UI
	static getConfigElement() {
		const editor = document.createElement('mhd-ba-card-editor');
		return editor;
	}

	// Return the card configuration element for validation
	static getStubConfig() {
		return {
			entity: '',
			title: null
		};
	}

    // Add getter to expose this._hass as this.hass
    get hass() {
        return this._hass;
    }

    set hass(hass) {
        this._hass = hass;

        // Set default title from entity if needed
        if ((this.title === null || this.title === ''|| this.title === 'null') && this._primaryEntity && hass.states[this._primaryEntity]) {
            this.title = hass.states[this._primaryEntity].attributes.friendly_name || this._primaryEntity;
        }

        if (!this.tableDiv) {
            const card = document.createElement('ha-card');

            var header = document.createElement('div');
            header.className = "card-header";
            header.appendChild(document.createTextNode(this.title));

            // Add click handler to open entity detail dialog when header is clicked
            if (this._primaryEntity) {
                header.style.cursor = "pointer";
                header.addEventListener('click', () => {
                    const event = new CustomEvent('hass-more-info', {
                        detail: {
                            entityId: this._primaryEntity
                        },
                        bubbles: true,
                        composed: true
                    });
                    this.dispatchEvent(event);
                });
            }

            card.appendChild(header);

            this.tableDiv = document.createElement('div');
            this.tableDiv.id = "mhdBaCard";
            card.appendChild(this.tableDiv);
            this.appendChild(card);
            this.initTable(this.tableDiv);
        } else {
            this.updateTable();
        }
    }

    setConfig(config) {
        this.entities = [];
        this.entities_names = [];

        this._config = config;

        // Use entity's friendly name as default title if no title provided
        if (config.title === null || config.title === '' || config.title === undefined) {
            this.title = null; // Will be set in hass() when entity data is available
        } else {
            this.title = config.title;
        }

		this._cardBuilt = new Promise(
		  (resolve) => (this._cardBuiltResolve = resolve)
		);

        if (config.entity) {
            this.entities.push(config.entity);
            // Make sure we store the primary entity for use in getData
            this._primaryEntity = config.entity;
        }

        if (config.entities) {
            config.entities.forEach((entity) => {
                if (typeof entity === 'string') {
                    this.entities.push(entity);
                } else {
                    this.entities.push(entity.entity_id);
                    this.entities_names[entity.entity_id] = entity.name;
                }
            });

            // If no primary entity set yet but we have entities, use the first one
            if (!this._primaryEntity && this.entities.length > 0) {
                this._primaryEntity = this.entities[0];
            }
        }
    }

    async initTable(ele) {
        // Create the table structure only once
        this.createTableStructure(ele);

        // Initial population of rows
        var data = await this.getData();
        this.updateTableRows(data);

		this._cardBuiltResolve?.();
    }

    async updateTable() {
        var data = await this.getData(true);
        this.updateTableRows(data);
    }

    async getData(forceUpdate) {
        // Use primary entity or fall back to first in config.entity
        const entityId = this._primaryEntity || this._config?.entity;

        if (!entityId || !this._hass || !this._hass.states[entityId]) {
            console.warn("MHD BA Card: Entity not found or not ready", entityId);
            return [];
        }

        const entityData = this._hass.states[entityId];
        if (!entityData.attributes || !entityData.attributes["departures"]) {
            console.warn("MHD BA Card: No departures data available");
            return [];
        }

        // Make a copy of the departures array and sort it by departure_calculated
        const departures = [...entityData.attributes["departures"]];
        departures.sort((a, b) => {
            // If departure_calculated is available, use it for sorting
            if (a.departure_calculated !== undefined && b.departure_calculated !== undefined) {
                return a.departure_calculated - b.departure_calculated;
            }
            // Fall back to planed_departure if departure_calculated is not available
            return a.planed_departure - b.planed_departure;
        });

        return departures;
    }

	async getCardSize() {
		await this._cardBuilt;
		return this._itemCount + 4;
	}

    createTableStructure(parentElement) {
        // Create the table structure only once
        var tbl = document.createElement('table');
        tbl.style.width = '100%';
        tbl.style.padding = '10px';
        tbl.setAttribute('border', '0');

        // Create table header
        var thead = document.createElement('thead');
        var headerRow = document.createElement('tr');

        var lineHeader = document.createElement('th');
        lineHeader.appendChild(document.createTextNode('Line'));
        lineHeader.style.fontWeight = "bold";
        lineHeader.style.textAlign = "left";
        headerRow.appendChild(lineHeader);

        var destinationHeader = document.createElement('th');
        destinationHeader.appendChild(document.createTextNode('Destination'));
        destinationHeader.style.fontWeight = "bold";
        destinationHeader.style.textAlign = "left";
        headerRow.appendChild(destinationHeader);

        var departuresHeader = document.createElement('th');
        departuresHeader.appendChild(document.createTextNode('Departure in'));
        departuresHeader.style.fontWeight = "bold";
        departuresHeader.style.textAlign = "right";
        headerRow.appendChild(departuresHeader);

        thead.appendChild(headerRow);
        tbl.appendChild(thead);

        // Create tbody to hold the data rows
        var tbdy = document.createElement('tbody');
        tbdy.id = "mhdBaTableBody";
        tbl.appendChild(tbdy);

        // Save references for later use
        this.table = tbl;
        this.tableBody = tbdy;

        // Append to parent
        parentElement.appendChild(tbl);
    }

    updateTableRows(data) {
        // Clear existing rows first
        while (this.tableBody.firstChild) {
            this.tableBody.removeChild(this.tableBody.firstChild);
        }

        // Add new rows
        this._itemCount = data.length;
        for (const dataRow of data) {
            var tr = document.createElement('tr');
            var td1 = document.createElement('td');
            var td2 = document.createElement('td');
            var td3 = document.createElement('td');

            td1.appendChild(document.createTextNode(dataRow.line));
            tr.appendChild(td1);

            td3.appendChild(document.createTextNode(dataRow.destination));
            tr.appendChild(td3);

            let departureInMinutes = dataRow.minutes_until_departure <= 0 ? "Now" : dataRow.minutes_until_departure + " min";
            td2.appendChild(document.createTextNode(departureInMinutes));
            td2.style.textAlign = "right";
            tr.appendChild(td2);

            this.tableBody.appendChild(tr);
        }
    }
}

// Define the card editor
customElements.define('mhd-ba-card', MhdBaCard);

// Editor implementation for the custom card
class MhdBaCardEditor extends HTMLElement {
    constructor() {
        super();
        this._config = {
            entity: '',
            title: null
        };
        this._hass = null;
        this._debounceTimeout = null;
        this.attachShadow({ mode: 'open' });
    }

    setConfig(config) {
        this._config = { ...config };
        this._configChanged = false;
        this.render();
    }

    // Define the schema for ha-form
    get _schema() {
        return [
            {
                name: "title",
                selector: {
                    text: {}
                },
            },
            {
                name: "entity",
                selector: {
                    entity: {
                        domain: ["sensor"]
                    }
                },
            },
        ];
    }

    render() {
        if (!this.shadowRoot) return;

        if(this.shadowRoot.querySelector("ha-form")) {
            // If the form already exists, just update it
            const form = this.shadowRoot.querySelector("ha-form");
            form.data = this._config;
            form.schema = this._schema;
            return;
        }

        // Clear shadowRoot content
        while (this.shadowRoot.lastChild) {
            this.shadowRoot.removeChild(this.shadowRoot.lastChild);
        }

        // Create the form - ha-form handles rendering of all inputs based on schema
        const form = document.createElement("ha-form");
        // Make sure we set hass before setting other properties
        if (this._hass) {
            form.hass = this._hass;
        }

        form.schema = this._schema;
        form.data = this._config;
        form.computeLabel = (schema) => schema.name.charAt(0).toUpperCase() + schema.name.slice(1);

        // Listen for value changes
        form.addEventListener("value-changed", (ev) => {
            if (!this._config || !this.shadowRoot || !ev.detail || !ev.detail.value) {
                return;
            }

            // Update the config
            this._config = ev.detail.value;

            // Use debouncing to prevent re-rendering on each keystroke
            if (this._debounceTimeout) {
                clearTimeout(this._debounceTimeout);
            }

            this._debounceTimeout = setTimeout(() => {
                // Notify Lovelace of the changed config
                this._configChanged = true;
                this._fireEvent();
            }, 500); // Wait 500ms before updating
        });

        // Add a help text below the form
        const helpText = document.createElement("div");
        helpText.style.color = "var(--secondary-text-color)";
        helpText.style.padding = "8px 0";
        helpText.style.fontSize = "12px";
        helpText.textContent = "Select the sensor entity that provides MHD BA departures data";

        // Add form and helptext to shadowRoot
        const container = document.createElement("div");
        container.style.padding = "8px";
        container.appendChild(form);
        container.appendChild(helpText);

        this.shadowRoot.appendChild(container);
    }

    _fireEvent() {
        if (!this._configChanged) return;

        // Notify Lovelace of the changed config
        const event = new CustomEvent("config-changed", {
            detail: { config: this._config },
            bubbles: true,
            composed: true,
        });
        this.dispatchEvent(event);
        this._configChanged = false;
    }

    set hass(hass) {
        this._hass = hass;

        // Pass hass to ha-form if it exists
        const form = this.shadowRoot?.querySelector("ha-form");
        if (form) {
            form.hass = hass;
        }
    }
}

// Register the editor component BEFORE the card component registers with customCards
customElements.define('mhd-ba-card-editor', MhdBaCardEditor);

// Register card with Lovelace
window.customCards = window.customCards || [];
window.customCards.push({
  type: "mhd-ba-card",
  name: "MHD BA Departures",
  description: "A card that shows public transport departures"
});
