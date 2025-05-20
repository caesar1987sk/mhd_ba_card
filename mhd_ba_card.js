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
      title: null,
    };
  }

  // Add getter to expose this._hass as this.hass
  get hass() {
    return this._hass;
  }

  set hass(hass) {
    this._hass = hass;

    this.title = this._config.title || null;

    // Set default title from entity if needed or empty string
    if (this.title === null || this.title === '' || this.title === 'null') {
      if (this._primaryEntity && hass.states[this._primaryEntity]) {
        this.title = hass.states[this._primaryEntity].attributes.friendly_name || this._primaryEntity;
      } else {
        this.title = '';
      }
    }

    if (!this.tableDiv) {
      const card = document.createElement('ha-card');

      var header = document.createElement('div');
      header.className = 'card-header';
      header.appendChild(document.createTextNode(this.title));

      // Add click handler to open entity detail dialog when header is clicked
      if (this._primaryEntity) {
        header.style.cursor = 'pointer';
        header.addEventListener('click', () => {
          const event = new CustomEvent('hass-more-info', {
            detail: {
              entityId: this._primaryEntity,
            },
            bubbles: true,
            composed: true,
          });
          this.dispatchEvent(event);
        });
      }

      card.appendChild(header);

      this.tableDiv = document.createElement('div');
      this.tableDiv.id = 'mhdBaCard';
      card.appendChild(this.tableDiv);
      this.appendChild(card);
      this.initTable(this.tableDiv);
    } else {
      this.updateTable();
    }
  }

  setConfig(config) {
    this.entities = [];
    this.title = null;

    this._config = config;

    this._cardBuilt = new Promise((resolve) => (this._cardBuiltResolve = resolve));

    if (config.entity) {
      this.entities.push(config.entity);
      // Make sure we store the primary entity for use in getData
      this._primaryEntity = config.entity;
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
    const entityId = this._primaryEntity;

    if (!entityId || !this._hass || !this._hass.states[entityId]) {
      console.warn('MHD BA Card: Entity not found or not ready', entityId);
      return [];
    }

    const entityData = this._hass.states[entityId];
    if (!entityData.attributes || !entityData.attributes['departures']) {
      console.warn('MHD BA Card: No departures data available');
      return [];
    }

    // Make a copy of the departures array and sort it by actual_departure
    const departures = [...entityData.attributes['departures']];
    departures.sort((a, b) => {
      // If actual_departure is available, use it for sorting
      if (a.actual_departure !== undefined && b.actual_departure !== undefined) {
        return a.actual_departure - b.actual_departure;
      }
      // Fall back to planed_departure if actual_departure is not available
      return a.planed_departure - b.planed_departure;
    });

    return departures;
  }

  async getCardSize() {
    await this._cardBuilt;
    return this._itemCount + 1;
  }

  createTableStructure(parentElement) {
    // Create the table structure only once
    var tbl = document.createElement('table');
    tbl.style.width = '100%';
    tbl.style.padding = '5px';
    tbl.style.border = '0';

    // Create table header
    var thead = document.createElement('thead');
    var headerRow = document.createElement('tr');

    var lineHeader = document.createElement('th');
    lineHeader.appendChild(document.createTextNode('Line'));
    lineHeader.style.fontWeight = 'bold';
    lineHeader.style.textAlign = 'left';
    headerRow.appendChild(lineHeader);

    var destinationHeader = document.createElement('th');
    destinationHeader.appendChild(document.createTextNode('Destination'));
    destinationHeader.style.fontWeight = 'bold';
    destinationHeader.style.textAlign = 'left';
    headerRow.appendChild(destinationHeader);

    var departuresHeader = document.createElement('th');
    departuresHeader.appendChild(document.createTextNode('Departure'));
    departuresHeader.style.fontWeight = 'bold';
    departuresHeader.style.textAlign = 'center';
    departuresHeader.colSpan = 2;
    headerRow.appendChild(departuresHeader);

    thead.appendChild(headerRow);
    tbl.appendChild(thead);

    // Create tbody to hold the data rows
    var tbdy = document.createElement('tbody');
    tbdy.id = 'mhdBaTableBody';
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
      var td_line = document.createElement('td');
      var td_departure_in = document.createElement('td');
      var td_departure_time = document.createElement('td');
      var td_destination = document.createElement('td');
      var td_destination = document.createElement('td');

      // Create line number with styling
      // TODO: add color based on line number?
      // https://www.idsbk.sk/download/az1f004rx40d.pdf
      // https://www.idsbk.sk/download/az1f003rx41d.pdf
      const lineSpan = document.createElement('span');
      lineSpan.style.position = 'relative';
      lineSpan.style.padding = '.125em';
      lineSpan.style.borderRadius = '0.25em';
      lineSpan.style.display = 'inline-block';
      lineSpan.style.minWidth = '1.84375em';
      lineSpan.style.minHeight = '1.84375em';
      lineSpan.style.height = '1.84375em';
      lineSpan.style.fontSize = '0.875em';
      lineSpan.style.backgroundColor = '#808080';
      lineSpan.style.borderColor = '#808080';
      lineSpan.style.textAlign = 'center';
      lineSpan.style.color = '#fff';
      lineSpan.style.fontWeight = 'bold';

      lineSpan.appendChild(document.createTextNode(dataRow.line));
      td_line.appendChild(lineSpan);
      tr.appendChild(td_line);

      td_destination.appendChild(document.createTextNode(dataRow.destination));
      tr.appendChild(td_destination);

      td_departure_time.style.textAlign = 'right';

      const timeSpan = document.createElement('span');
      // Add departure time with smaller font if available
      if (dataRow.actual_departure_formatted && dataRow.minutes_until_actual_departure > 0) {
        timeSpan.style.fontSize = '0.8em';
        timeSpan.style.color = 'var(--secondary-text-color)';
        timeSpan.appendChild(document.createTextNode(dataRow.actual_departure_formatted));
      }
      td_departure_time.appendChild(timeSpan);
      tr.appendChild(td_departure_time);

      // Add departure in minutes
      td_departure_in.style.textAlign = 'right';
      let departureInMinutes =
        dataRow.minutes_until_actual_departure <= 0 ? 'Now' : dataRow.minutes_until_actual_departure + ' min';
      td_departure_in.appendChild(document.createTextNode(departureInMinutes));

      tr.appendChild(td_departure_in);

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
      title: null,
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
        name: 'title',
        selector: {
          text: {},
        },
      },
      {
        name: 'entity',
        selector: {
          entity: {
            domain: ['sensor'],
          },
        },
      },
    ];
  }

  render() {
    if (!this.shadowRoot) return;

    if (this.shadowRoot.querySelector('ha-form')) {
      // If the form already exists, just update it
      const form = this.shadowRoot.querySelector('ha-form');
      form.data = this._config;
      form.schema = this._schema;
      return;
    }

    // Clear shadowRoot content
    while (this.shadowRoot.lastChild) {
      console.log('Removing child from shadowRoot');
      this.shadowRoot.removeChild(this.shadowRoot.lastChild);
    }

    // Create the form - ha-form handles rendering of all inputs based on schema
    const form = document.createElement('ha-form');
    // Make sure we set hass before setting other properties
    if (this._hass) {
      form.hass = this._hass;
    }

    form.schema = this._schema;
    form.data = this._config;
    form.computeLabel = (schema) => schema.name.charAt(0).toUpperCase() + schema.name.slice(1);

    // Listen for value changes
    form.addEventListener('value-changed', (ev) => {
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
    const helpText = document.createElement('div');
    helpText.style.color = 'var(--secondary-text-color)';
    helpText.style.padding = '8px 0';
    helpText.style.fontSize = '12px';
    helpText.textContent =
      'Select the sensor entity that provides MHD BA departures data. Custom title can be specified, or it will default to the entity name.';

    // Add form and helptext to shadowRoot
    const container = document.createElement('div');
    container.style.padding = '8px';
    container.appendChild(form);
    container.appendChild(helpText);

    this.shadowRoot.appendChild(container);
  }

  _fireEvent() {
    if (!this._configChanged) return;

    // Notify Lovelace of the changed config
    const event = new CustomEvent('config-changed', {
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
    const form = this.shadowRoot?.querySelector('ha-form');
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
  type: 'mhd-ba-card',
  name: 'MHD BA Departures',
  description: 'A card that shows public transport departures',
});
