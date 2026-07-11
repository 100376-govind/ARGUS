export interface IEventBus {
  /**
   * Publishes an event to the redis and local system buses.
   * @param eventName Name of the event to fire e.g. IncidentCreated
   * @param payload Payload data
   */
  publish(eventName: string, payload: any): Promise<void>;
  
  /**
   * Subscribes to events on the system bus.
   */
  subscribe(eventName: string, callback: (payload: any) => void): Promise<void>;
}
