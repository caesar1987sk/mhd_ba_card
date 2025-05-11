class MhdBaCard extends HTMLElement {
	_cardBuilt;
	_cardBuiltResolve;
	_itemCount = 0;

	// Return the card editor for configuration in the UI
	static getConfigElement() {
		return document.createElement('mhd-ba-card-editor');
	}

	// Return the card configuration element for validation
	static getStubConfig() {
		return {
			entity: '',
			title: null
		};
	}

    set hass(hass) {
        this._hass = hass;

        // Set default title from entity if needed
        if ((this.title === null || this.title === ''|| this.title === 'null') && this._primaryEntity && hass.states[this._primaryEntity]) {
            this.title = hass.states[this._primaryEntity].attributes.friendly_name || this._primaryEntity;
        }
        console.log(hass.states[this._primaryEntity].attributes.friendly_name);
        console.log(this.title);

        if (!this.tableDiv) {
            const card = document.createElement('ha-card');

            var header = document.createElement('div');
            header.className = "card-header";
            header.appendChild(document.createTextNode(this.title));
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

        return entityData.attributes["departures"];
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
        headerRow.appendChild(lineHeader);

        var destinationHeader = document.createElement('th');
        destinationHeader.appendChild(document.createTextNode('Destination'));
        destinationHeader.style.fontWeight = "bold";
        headerRow.appendChild(destinationHeader);

        var departuresHeader = document.createElement('th');
        departuresHeader.appendChild(document.createTextNode('Departures'));
        departuresHeader.style.fontWeight = "bold";
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

            td2.appendChild(document.createTextNode(dataRow.calculated_departure_formatted));
            tr.appendChild(td2);

            this.tableBody.appendChild(tr);
        }
    }
}

// Define the card editor
customElements.define('mhd-ba-card', MhdBaCard);

// Editor using lit-element for better compatibility
class MhdBaCardEditor extends HTMLElement {
    constructor() {
        super();
        this._config = {
            entity: '',
            title: null
        };
        this.attachShadow({ mode: 'open' });
    }

    setConfig(config) {
        this._config = { ...config };
        this.render();
    }

    // The height of your card editor. Home Assistant uses this to automatically
    // adjust UI height. Use this if you have UI elements outside the standard
    // card size. Usually, leave it undefined.
    get editor() {
        return this.shadowRoot.getElementById('editor');
    }

    render() {
        if (!this.shadowRoot) return;

        // Handle the case where the editor is already rendered
        if (this.shadowRoot.lastChild) {
            this.shadowRoot.removeChild(this.shadowRoot.lastChild);
        }

        // Create editor wrapper
        const wrapper = document.createElement('div');
        wrapper.id = 'editor';
        wrapper.style.padding = '8px';

        // Add script to load necessary frontend components
        if (!customElements.get('ha-entity-picker')) {
            const script = document.createElement('script');
            script.src = '/frontend_latest/panel-config.js';
            document.head.appendChild(script);
        }

        // Create title field
        const titleField = document.createElement('ha-textfield');
        titleField.label = "Title";
        titleField.value = this._config.title || '';
        titleField.configValue = 'title';
        titleField.style.display = 'block';
        titleField.style.width = '100%';
        titleField.style.marginBottom = '16px';
        titleField.addEventListener('input', this._valueChanged.bind(this));

        // Create the entity picker separately
        const entityRow = document.createElement('div');
        entityRow.className = 'row';
        entityRow.style.marginTop = '16px';

        // Wait for entity picker to be defined
        this._createEntityPicker(entityRow);

        // Add elements to wrapper
        wrapper.appendChild(titleField);
        wrapper.appendChild(entityRow);

        this.shadowRoot.appendChild(wrapper);
    }

    async _createEntityPicker(container) {
        // Try to ensure the entity picker component is loaded
        if (!customElements.get('ha-entity-picker')) {
            // Wait a moment for components to load if they were just requested
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (customElements.get('ha-entity-picker')) {
            const entityPicker = document.createElement('ha-entity-picker');
            entityPicker.label = "Entity";
            entityPicker.value = this._config.entity || '';
            entityPicker.configValue = 'entity';
            entityPicker.includeDomains = ['sensor'];
            entityPicker.allowCustomEntity = true;
            entityPicker.style.display = 'block';
            entityPicker.style.width = '100%';

            if (this._hass) {
                entityPicker.hass = this._hass;
            }

            entityPicker.addEventListener('value-changed', this._valueChanged.bind(this));
            container.appendChild(entityPicker);
        } else {
            // Fallback to a simple input if entity picker doesn't load
            const input = document.createElement('ha-textfield');
            input.label = "Entity ID";
            input.value = this._config.entity || '';
            input.configValue = 'entity';
            input.style.display = 'block';
            input.style.width = '100%';
            input.addEventListener('input', this._valueChanged.bind(this));
            container.appendChild(input);
        }
    }

    _valueChanged(ev) {
        if (!this._config || !this.shadowRoot) return;

        const target = ev.target;
        const configValue = target.configValue;

        if (!configValue) return;

        // Handle different ways an entity picker can report a change
        if (configValue === 'entity' && ev.type === 'value-changed') {
            this._config = {
                ...this._config,
                [configValue]: ev.detail.value
            };
        } else {
            this._config = {
                ...this._config,
                [configValue]: target.value
            };
        }

        // Notify Lovelace of the changed config
        const event = new CustomEvent('config-changed', {
            detail: { config: this._config },
            bubbles: true,
            composed: true,
        });
        this.dispatchEvent(event);
    }

    // This gets called when the card editor is first loaded or when the hass state changes
    set hass(hass) {
        this._hass = hass;
        this.render();
    }

    // This gets called after connectedCallback when the element is added to the DOM
    connectedCallback() {
        this.render();
    }
}

customElements.define('mhd-ba-card-editor', MhdBaCardEditor);

// Register card with Lovelace
window.customCards = window.customCards || [];
window.customCards.push({
  type: "mhd-ba-card",
  name: "MHD BA Departures",
  description: "A card that shows public transport departures"
});
